import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { OptionStore, type Option } from "../store/option.js";

const store = new OptionStore();

const composer = new Composer<Ctx>();

composer.on("poll", async (ctx) => {
  const poll = ctx.update.poll;
  if (!poll || !poll.id) return;

  if (!poll.options || poll.options.length === 0) return;

  for (let i = 0; i < poll.options.length; i++) {
    const pollOption = poll.options[i];
    const optionId = `${poll.id}_opt_${i}`;

    const existing = await store.getById(optionId);
    if (existing) continue;

    const option: Option = {
      id: optionId,
      poll_id: poll.id,
      text: pollOption.text,
      position: i,
    };

    await store.create(option);
  }
});

export default composer;