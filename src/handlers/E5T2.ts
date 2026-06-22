import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore } from "../store/vote.js";
import { PollStore } from "../store/poll.js";

const voteStore = new VoteStore();
const pollStore = new PollStore();

const composer = new Composer<Ctx>();

composer.on("callback_query:data", async (ctx) => {
  console.error("E5T2: handler entered");
  const data = ctx.callbackQuery.data;
  console.error("E5T2: data=" + data);
  if (!data.startsWith("vote:opt:")) return;

  const parts = data.split(":");
  const pollId = parts[2];
  const optIndexStr = parts[3];

  if (!pollId || optIndexStr === undefined) return;

  const userId = ctx.from!.id;
  const optIndex = parseInt(optIndexStr, 10);
  console.error("E5T2: pollId=" + pollId + " userId=" + userId);

  const poll = await pollStore.getById(pollId);
  console.error("E5T2: poll=" + JSON.stringify(poll));
  if (poll && poll.is_closed) {
    await ctx.answerCallbackQuery({ text: "This poll is closed.", show_alert: true });
    return;
  }

  const optionId = `${pollId}_opt_${optIndex}`;
  const voteId = `vote_${pollId}_${userId}_${optIndex}`;

  const existingVote = await voteStore.getVoteByUserAndPoll(pollId, userId);
  console.error("E5T2: existingVote=" + JSON.stringify(existingVote));
  const wasOverwrite = existingVote !== null && existingVote.option_id !== optionId;
  console.error("E5T2: wasOverwrite=" + wasOverwrite);

  const vote = {
    id: voteId,
    poll_id: pollId,
    user_id: userId,
    option_id: optionId,
    created_at: new Date().toISOString(),
  };

  const updated = await voteStore.update(vote);
  console.error("E5T2: update result=" + JSON.stringify(updated));

  if (wasOverwrite) {
    console.error("E5T2: sending Vote updated!");
    await ctx.answerCallbackQuery({ text: "Vote updated!" });
  } else {
    console.error("E5T2: sending Vote recorded!");
    await ctx.answerCallbackQuery({ text: "Vote recorded!" });
  }
  console.error("E5T2: done");
});

export default composer;