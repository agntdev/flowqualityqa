import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore } from "../store/vote.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const voteStore = new VoteStore();
const pollStore = new PollStore();
const optionStore = new OptionStore();

const MIN_EDIT_INTERVAL_MS = 2000;
const pollEditTimestamps = new Map<string, number>();

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildLivePollKeyboard(pollId: string, optionCount: number) {
  const rows = [];
  for (let i = 0; i < optionCount; i++) {
    rows.push([inlineButton("Vote", `vote:opt:${pollId}:${i}`)]);
  }
  rows.push([inlineButton("Close poll", `poll:close:${pollId}`)]);
  return inlineKeyboard(rows);
}

async function getVoteCounts(pollId: string): Promise<Map<string, number>> {
  const votes = await voteStore.listByPoll(pollId);
  const counts = new Map<string, number>();
  for (const vote of votes) {
    const count = counts.get(vote.option_id) ?? 0;
    counts.set(vote.option_id, count + 1);
  }
  return counts;
}

function formatLiveResultsText(
  question: string,
  anonymous: boolean,
  options: Array<{ id: string; text: string; position: number }>,
  counts: Map<string, number>,
): string {
  const type = anonymous ? "Anonymous" : "Public";
  let total = 0;
  for (const [, count] of counts) {
    total += count;
  }
  let text = `<b>${escapeHtml(question)}</b>\n`;
  text += `<i>${type} poll \u2022 ${total} vote${total !== 1 ? "s" : ""}</i>\n\n`;

  for (const opt of options) {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar = "\u2588".repeat(pct > 0 ? Math.max(1, Math.round(pct / 5)) : 0);
    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n\n`;
  }

  return text;
}

async function tryEditPollMessage(ctx: Ctx, pollId: string) {
  const now = Date.now();
  const lastEdit = pollEditTimestamps.get(pollId);
  if (lastEdit && now - lastEdit < MIN_EDIT_INTERVAL_MS) {
    return;
  }
  pollEditTimestamps.set(pollId, now);

  try {
    const poll = await pollStore.getById(pollId);
    if (!poll || poll.is_closed) return;

    const options = await optionStore.listByPoll(pollId);
    if (options.length === 0) return;

    const counts = await getVoteCounts(pollId);

    const text = formatLiveResultsText(
      poll.question,
      poll.is_anonymous,
      options,
      counts,
    );

    await ctx.api.editMessageText(
      poll.chat_id,
      poll.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: buildLivePollKeyboard(pollId, options.length),
      },
    );
  } catch {
    // Swallow: message may be too old or deleted
  }
}

composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  const isVoteCallback = data.startsWith("vote:opt:");
  if (!isVoteCallback) return next();

  const parts = data.split(":");
  const pollId = parts[2];
  if (pollId) {
    await tryEditPollMessage(ctx, pollId);
  }
  await next();
});

composer.on("poll_answer", async (ctx) => {
  const answer = ctx.pollAnswer;
  if (!answer?.poll_id) return;

  await tryEditPollMessage(ctx, answer.poll_id);
});

export default composer;