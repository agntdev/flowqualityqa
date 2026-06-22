import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore } from "../store/vote.js";
import { PollStore } from "../store/poll.js";

const voteStore = new VoteStore();
const pollStore = new PollStore();

const composer = new Composer<Ctx>();

composer.on("callback_query:data", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data.startsWith("vote:opt:")) return next();

  const parts = data.split(":");
  const pollId = parts[2];
  const optIndexStr = parts[3];

  if (!pollId || optIndexStr === undefined) return;

  const userId = ctx.from!.id;
  const optIndex = parseInt(optIndexStr, 10);

  const poll = await pollStore.getById(pollId);
  if (poll && poll.is_closed) {
    await ctx.answerCallbackQuery({ text: "This poll is closed.", show_alert: true });
    return;
  }

  const optionId = `${pollId}_opt_${optIndex}`;
  const voteId = `vote_${pollId}_${userId}_${optIndex}`;

  const vote = {
    id: voteId,
    poll_id: pollId,
    user_id: userId,
    option_id: optionId,
    created_at: new Date().toISOString(),
  };

  const recorded = await voteStore.update(vote);

  if (recorded) {
    await ctx.answerCallbackQuery({ text: "Vote recorded!" });
  }
});

export default composer;