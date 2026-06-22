import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { VoteStore } from "../store/vote.js";
import { inlineKeyboard } from "../toolkit/index.js";
import { getRedisClient, getInMemoryClient } from "../store/redis.js";

const sharedRedis = getRedisClient() ?? getInMemoryClient();
export const pollStore = new PollStore(sharedRedis);
export const optionStore = new OptionStore(sharedRedis);
export const voteStore = new VoteStore(sharedRedis);

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

composer.on("poll", async (ctx) => {
  const pollUpdate = ctx.update.poll;
  if (!pollUpdate?.id || !pollUpdate.is_closed) return;

  const poll = await pollStore.getById(pollUpdate.id);
  if (!poll) return;

  const options = await optionStore.listByPoll(poll.id);
  if (options.length === 0) return;

  const votes = await voteStore.listByPoll(poll.id);
  const counts = new Map<string, number>();
  for (const v of votes) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
  }

  let total = 0;
  for (const [, c] of counts) {
    total += c;
  }

  let text = `<b>${escapeHtml(poll.question)}</b>\n`;
  text += `<i>${poll.is_anonymous ? "Anonymous" : "Public"} poll \u2022 ${total} vote${total !== 1 ? "s" : ""}</i>\n`;
  text += `<i>\u26A0\uFE0F Poll is closed</i>\n\n`;

  for (const opt of options) {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const bar = "\u2588".repeat(pct > 0 ? Math.max(1, Math.round(pct / 5)) : 0);
    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n\n`;
  }

  try {
    await ctx.api.editMessageText(
      poll.chat_id,
      poll.message_id,
      text,
      {
        parse_mode: "HTML",
        reply_markup: inlineKeyboard([]),
      },
    );
  } catch {
    // message may have been deleted, or not editable (e.g., native poll message)
  }
});

composer.on("poll_answer", async (ctx) => {
  const answer = ctx.pollAnswer;
  if (!answer?.poll_id) return;

  const poll = await pollStore.getById(answer.poll_id);
  if (!poll?.is_closed) return;

  const user = answer.user ?? answer.voter_chat;
  if (user) {
    try {
      await ctx.api.sendMessage(user.id, "Poll is closed");
    } catch {
      // user may have blocked the bot or can't receive messages
    }
  }
});

export default composer;