import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { VoteStore } from "../store/vote.js";

const pollStore = new PollStore();
const optionStore = new OptionStore();
const voteStore = new VoteStore();

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function isAuthorized(
  ctx: Ctx,
  userId: number,
  chatId: number,
  creatorUserId: number,
): Promise<boolean> {
  if (userId === creatorUserId) return true;
  try {
    const admins = await ctx.api.getChatAdministrators(chatId);
    return admins.some((a) => a.user.id === userId);
  } catch {
    return false;
  }
}

function matchesCreator(ctx: Ctx, creatorUserId: number): boolean {
  return ctx.from!.id === creatorUserId;
}

composer.callbackQuery(/^poll:close:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  // Format: poll:close:<creatorUserId>:<messageId>:<pollId>
  const parts = data.split(":");
  if (parts.length < 5) {
    await ctx.answerCallbackQuery();
    return;
  }

  const prefixParts = 2; // "poll" + "close"
  const creatorUserId = parseInt(parts[prefixParts], 10);
  const pollMessageId = parseInt(parts[prefixParts + 1], 10);
  const pollId = parts.slice(prefixParts + 2).join(":");

  if (isNaN(creatorUserId) || isNaN(pollMessageId) || !pollId) {
    await ctx.answerCallbackQuery();
    return;
  }

  if (!matchesCreator(ctx, creatorUserId)) {
    await ctx.answerCallbackQuery({
      text: "Only the poll creator or a chat admin can close this poll.",
      show_alert: true,
    });
    return;
  }

  const poll = await pollStore.getById(pollId);
  if (poll?.is_closed) {
    await ctx.answerCallbackQuery({ text: "Poll is already closed.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const chatId = ctx.callbackQuery.message?.chat.id;
  if (chatId != null) {
    try {
      await ctx.api.stopPoll(chatId, pollMessageId);
    } catch {
      // poll might already be closed at Telegram level
    }
  }

  await pollStore.close(pollId, new Date().toISOString());

  const callbackMessage = ctx.callbackQuery.message;
  if (callbackMessage) {
    await ctx.api.editMessageText(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      "\u2705 Poll closed.",
      {
        reply_markup: inlineKeyboard([
          [inlineButton("\u{1F4CA} Results", `poll:results:${pollId}`)],
          [inlineButton("Export", `poll:export:${pollId}`)],
        ]),
      },
    );
  }
});

composer.callbackQuery(/^poll:results:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  const prefix = "poll:results:";
  const pollId = data.slice(prefix.length);
  if (!pollId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.answerCallbackQuery({ text: "Poll not found.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const options = await optionStore.listByPoll(pollId);
  const votes = await voteStore.listByPoll(pollId);

  const voteCounts = new Map<string, number>();
  for (const v of votes) {
    voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
  }

  const totalVotes = votes.length;

  let text = `<b>\u{1F4CA} Results</b>\n\n`;
  text += `<b>Question:</b> ${escapeHtml(poll.question)}\n\n`;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const count = voteCounts.get(opt.id) ?? 0;
    const pct = totalVotes > 0
      ? Math.round((count / totalVotes) * 100)
      : 0;
    const bar = "\u2588".repeat(Math.round(pct / 10));
    text += `${escapeHtml(opt.text)}: ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n`;
    text += `<code>${bar}</code>\n`;
  }

  text += `\nTotal votes: ${totalVotes}`;

  const callbackMessage = ctx.callbackQuery.message;
  if (callbackMessage) {
    await ctx.api.editMessageText(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: [] },
      },
    );
  }
});

export default composer;