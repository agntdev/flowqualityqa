import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { VoteStore } from "../store/vote.js";
import { inlineKeyboard } from "../toolkit/index.js";

const pollStore = new PollStore();
const optionStore = new OptionStore();
const voteStore = new VoteStore();

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

composer.on("callback_query", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data || !data.startsWith("poll:live_results:")) return next();

  const pollId = data.slice("poll:live_results:".length);
  if (!pollId) return next();

  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.answerCallbackQuery({ text: "Poll not found." });
    return;
  }

  const options = await optionStore.listByPoll(pollId);
  const votes = await voteStore.listByPoll(pollId);

  const counts = new Map<string, number>();
  const voters = new Map<string, number[]>();
  for (const v of votes) {
    counts.set(v.option_id, (counts.get(v.option_id) ?? 0) + 1);
    if (!poll.is_anonymous) {
      const list = voters.get(v.option_id) ?? [];
      list.push(v.user_id);
      voters.set(v.option_id, list);
    }
  }

  let total = 0;
  for (const [, c] of counts) {
    total += c;
  }

  let text = `<b>📊 Results</b>\n\n`;
  text += `<b>Question:</b> ${escapeHtml(poll.question)}\n\n`;

  for (const opt of options) {
    const count = counts.get(opt.id) ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    const barLen = Math.round(pct / 5);
    const bar = "█".repeat(barLen);

    text += `<b>${escapeHtml(opt.text)}</b>\n`;
    text += `${bar} ${count} vote${count !== 1 ? "s" : ""} (${pct}%)\n`;

    if (!poll.is_anonymous) {
      const optVoters = voters.get(opt.id) ?? [];
      for (let i = 0; i < optVoters.length; i++) {
        text += `  ${i + 1}. User ${optVoters[i]}\n`;
      }
    }

    text += `\n`;
  }

  text += `Total votes: ${total}`;

  await ctx.answerCallbackQuery();
  await ctx.api.editMessageText(
    poll.chat_id,
    poll.message_id,
    text,
    {
      parse_mode: "HTML",
      reply_markup: inlineKeyboard([
        [{ text: "🔙 Back to poll", callback_data: `poll:back:${pollId}` }],
      ]),
    },
  );
});

export default composer;