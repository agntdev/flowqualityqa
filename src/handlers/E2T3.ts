import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore } from "../store/vote.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const voteStore = new VoteStore();
const pollStore = new PollStore();
const optionStore = new OptionStore();

const MAX_VOTERS_SHOWN = 10;

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildResultsKeyboard(pollId: string) {
  return inlineKeyboard([
    [inlineButton("\u{1F519} Back", `results:back:${pollId}`)],
  ]);
}

function buildLivePollKeyboardForResults(pollId: string, optionCount: number) {
  const rows = [];
  for (let i = 0; i < optionCount; i++) {
    rows.push([inlineButton("Vote", `vote:opt:${pollId}:${i}`)]);
  }
  rows.push([inlineButton("Results", `results:poll:${pollId}`), inlineButton("Close poll", `poll:close:${pollId}`)]);
  return inlineKeyboard(rows);
}

function formatVoterNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length <= MAX_VOTERS_SHOWN) {
    return names.join(", ");
  }
  const shown = names.slice(0, MAX_VOTERS_SHOWN).join(", ");
  const remaining = names.length - MAX_VOTERS_SHOWN;
  return `${shown}, and ${remaining} more`;
}

async function getVoteCountsAndVoters(pollId: string) {
  const votes = await voteStore.listByPoll(pollId);
  const counts = new Map<string, number>();
  const voters = new Map<string, string[]>();

  for (const vote of votes) {
    counts.set(vote.option_id, (counts.get(vote.option_id) ?? 0) + 1);
    const list = voters.get(vote.option_id) ?? [];
    list.push(vote.voter_name ?? `User #${vote.user_id}`);
    voters.set(vote.option_id, list);
  }

  return { counts, voters };
}

async function showResults(ctx: Ctx, pollId: string) {
  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.answerCallbackQuery({ text: "Poll not found.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const options = await optionStore.listByPoll(pollId);
  const { counts, voters } = await getVoteCountsAndVoters(pollId);

  let total = 0;
  for (const [, count] of counts) {
    total += count;
  }

  const isPublic = !poll.is_anonymous;
  const type = isPublic ? "Public" : "Anonymous";

  let text = `<b>\u{1F4CA} Results</b>\n\n`;
  text += `<b>${escapeHtml(poll.question)}</b>\n`;
  text += `<i>${type} poll \u2022 ${total} vote${total !== 1 ? "s" : ""}</i>\n\n`;

  for (const opt of options) {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar = "\u2588".repeat(pct > 0 ? Math.max(1, Math.round(pct / 5)) : 0);

    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n`;

    if (isPublic) {
      const optionVoters = voters.get(opt.id) ?? [];
      const names = formatVoterNames(optionVoters.map((n) => escapeHtml(n)));
      if (names) {
        text += `  ${names}\n`;
      }
    }
    text += "\n";
  }

  const callbackMessage = ctx.callbackQuery?.message;
  if (callbackMessage) {
    await ctx.api.editMessageText(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: buildResultsKeyboard(pollId),
      },
    );
  }
}

async function showLivePoll(ctx: Ctx, pollId: string) {
  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.answerCallbackQuery({ text: "Poll not found.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const options = await optionStore.listByPoll(pollId);
  const { counts } = await getVoteCountsAndVoters(pollId);

  let total = 0;
  for (const [, count] of counts) {
    total += count;
  }

  const type = poll.is_anonymous ? "Anonymous" : "Public";
  let text = `<b>${escapeHtml(poll.question)}</b>\n`;
  text += `<i>${type} poll \u2022 ${total} vote${total !== 1 ? "s" : ""}</i>\n\n`;

  for (const opt of options) {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar = "\u2588".repeat(pct > 0 ? Math.max(1, Math.round(pct / 5)) : 0);
    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n\n`;
  }

  const callbackMessage = ctx.callbackQuery?.message;
  if (callbackMessage) {
    await ctx.api.editMessageText(
      callbackMessage.chat.id,
      callbackMessage.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: buildLivePollKeyboardForResults(pollId, options.length),
      },
    );
  }
}

composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data) {
    await next();
    return;
  }

  if (data.startsWith("results:poll:")) {
    const pollId = data.slice("results:poll:".length);
    if (!pollId) {
      await ctx.answerCallbackQuery();
      await next();
      return;
    }
    await showResults(ctx, pollId);
    return;
  }

  if (data.startsWith("results:back:")) {
    const pollId = data.slice("results:back:".length);
    if (!pollId) {
      await ctx.answerCallbackQuery();
      await next();
      return;
    }
    await showLivePoll(ctx, pollId);
    return;
  }

  await next();
});

export default composer;