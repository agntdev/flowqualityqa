import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore } from "../store/vote.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";

const voteStore = new VoteStore();
const pollStore = new PollStore();
const optionStore = new OptionStore();

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

composer.command("votestatus", async (ctx) => {
  const pollId = (ctx.match ?? "").trim();
  if (!pollId) {
    await ctx.reply("Usage: /votestatus <poll_id>");
    return;
  }

  const userId = ctx.from!.id;
  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.reply("Poll not found. Check the poll ID and try again.");
    return;
  }

  const vote = await voteStore.getVoteByUserAndPoll(pollId, userId);
  if (!vote) {
    await ctx.reply("You have not voted in this poll yet.");
    return;
  }

  const options = await optionStore.listByPoll(pollId);
  const votedOption = options.find((o) => o.id === vote.option_id);
  const optText = votedOption ? votedOption.text : "Unknown option";
  await ctx.reply(
    `Your vote in poll "<b>${escapeHtml(poll.question)}</b>": <b>${escapeHtml(optText)}</b>`,
    { parse_mode: "HTML" },
  );
});

export default composer;
