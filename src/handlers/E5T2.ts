import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { VoteStore } from "../store/vote.js";

const pollStore = new PollStore();
const optionStore = new OptionStore();
const voteStore = new VoteStore();

const composer = new Composer<Ctx>();

composer.on("callback_query", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (!data || !data.startsWith("vote:opt:")) return next();

  const rest = data.slice("vote:opt:".length);
  const lastColon = rest.lastIndexOf(":");
  if (lastColon < 0) return;

  const pollId = rest.slice(0, lastColon);
  const position = parseInt(rest.slice(lastColon + 1), 10);
  if (isNaN(position)) return;

  const poll = await pollStore.getById(pollId);
  if (!poll || poll.is_closed) {
    await ctx.answerCallbackQuery({ text: "Poll is closed.", show_alert: true });
    return;
  }

  const options = await optionStore.listByPoll(pollId);
  const option = options.find((o) => o.position === position);
  if (!option) return;

  const userId = ctx.from!.id;
  const voteId = `v_${pollId}_${userId}`;

  await voteStore.upsert({
    id: voteId,
    poll_id: pollId,
    user_id: userId,
    option_id: option.id,
    created_at: new Date().toISOString(),
  });

  await ctx.answerCallbackQuery({ text: "Vote recorded!" });
});

export default composer;