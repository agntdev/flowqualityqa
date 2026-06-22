import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { VoteStore, type Vote } from "../store/vote.js";

const store = new VoteStore();

const composer = new Composer<Ctx>();

composer.on("poll_answer", async (ctx, next) => {
  const answer = ctx.pollAnswer;
  if (!answer) return;

  const pollId = answer.poll_id;
  if (!pollId) return;

  const user = answer.user ?? answer.voter_chat;
  if (!user) return;

  const userId = user.id;
  const optionIds = answer.option_ids;
  if (!optionIds || optionIds.length === 0) return;

  for (const optionIndex of optionIds) {
    const optionId = `${pollId}_opt_${optionIndex}`;
    const voteId = `${pollId}_vote_${userId}_${optionIndex}`;

    const vote: Vote = {
      id: voteId,
      poll_id: pollId,
      user_id: userId,
      option_id: optionId,
      created_at: new Date().toISOString(),
    };

    const existing = await store.getVoteByUserAndPoll(pollId, userId);
    if (existing) {
      await store.update(vote);
      continue;
    }

    await store.create(vote);
  }

  await next();
});

export default composer;
