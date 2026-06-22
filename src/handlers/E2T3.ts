import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore } from "../store/vote.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const voteStore = new VoteStore();
const pollStore = new PollStore();
const optionStore = new OptionStore();

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function resolveVoterName(
  ctx: Ctx,
  chatId: number,
  userId: number,
): Promise<string> {
  try {
    const member = await ctx.api.getChatMember(chatId, userId);
    return member.user.first_name || `User ${userId}`;
  } catch {
    return `User ${userId}`;
  }
}

composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("poll:live_results:")) return next();

  const pollId = data.slice("poll:live_results:".length);
  if (!pollId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.answerCallbackQuery({
      text: "Poll not found.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const options = await optionStore.listByPoll(pollId);
  const votes = await voteStore.listByPoll(pollId);

  const voteCounts = new Map<string, number>();
  const optionVoters = new Map<string, number[]>();

  for (const v of votes) {
    voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
    const voters = optionVoters.get(v.option_id) ?? [];
    voters.push(v.user_id);
    optionVoters.set(v.option_id, voters);
  }

  const totalVotes = votes.length;
  const isNamed = !poll.is_anonymous;
  const MAX_VOTERS_SHOWN = 10;

  let text = `<b>\u{1F4CA} Results</b>\n\n`;
  text += `<b>Question:</b> ${escapeHtml(poll.question)}\n\n`;

  for (const opt of options) {
    const count = voteCounts.get(opt.id) ?? 0;
    const pct =
      totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    const bar =
      "\u2588".repeat(pct > 0 ? Math.max(1, Math.round(pct / 5)) : 0);

    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n`;

    if (isNamed && count > 0) {
      const voterIds = optionVoters.get(opt.id) ?? [];
      const showCount = Math.min(voterIds.length, MAX_VOTERS_SHOWN);
      const chatId =
        ctx.callbackQuery.message?.chat.id ?? poll.chat_id;

      const names = await Promise.all(
        voterIds.slice(0, showCount).map((uid) =>
          resolveVoterName(ctx, chatId, uid),
        ),
      );

      for (let i = 0; i < showCount; i++) {
        text += `  ${i + 1}. ${escapeHtml(names[i])}\n`;
      }

      if (voterIds.length > MAX_VOTERS_SHOWN) {
        text += `  ...and ${voterIds.length - MAX_VOTERS_SHOWN} more\n`;
      }
    }

    text += `\n`;
  }

  text += `Total votes: ${totalVotes}`;

  const callbackMessage = ctx.callbackQuery.message;
  if (callbackMessage) {
    await ctx.api.editMessageText(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: inlineKeyboard([
          [inlineButton("\u{1F519} Back to poll", `poll:back:${pollId}`)],
        ]),
      },
    );
  }
});

composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("poll:back:")) return next();

  const pollId = data.slice("poll:back:".length);
  if (!pollId) {
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.answerCallbackQuery();

  const poll = await pollStore.getById(pollId);
  if (!poll || poll.is_closed) return;

  const options = await optionStore.listByPoll(pollId);
  if (options.length === 0) return;

  const votes = await voteStore.listByPoll(pollId);
  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
  }

  const total = votes.length;
  const type = poll.is_anonymous ? "Anonymous" : "Public";

  let text = `<b>${escapeHtml(poll.question)}</b>\n`;
  text += `<i>${type} poll \u2022 ${total} vote${total !== 1 ? "s" : ""}</i>\n\n`;

  for (const opt of options) {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar =
      "\u2588".repeat(pct > 0 ? Math.max(1, Math.round(pct / 5)) : 0);
    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n\n`;
  }

  const keyboardRows = options.map((_, i) => [
    inlineButton("Vote", `vote:opt:${pollId}:${i}`),
  ]);
  keyboardRows.push([
    inlineButton("Results", `poll:live_results:${pollId}`),
    inlineButton("Close poll", `poll:close:${poll.creator_user_id}:${poll.message_id}:${pollId}`),
  ]);

  const callbackMessage = ctx.callbackQuery.message;
  if (callbackMessage) {
    await ctx.api.editMessageText(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: inlineKeyboard(keyboardRows),
      },
    );
  }
});

export default composer;
