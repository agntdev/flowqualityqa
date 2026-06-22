import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_poll_question") return next();

  const text = ctx.message.text.trim();

  if (!text) {
    await ctx.reply("Question cannot be empty. Please enter a poll question:");
    return;
  }

  if (!ctx.session.poll) return;

  ctx.session.poll.question = text;
  ctx.session.step = "awaiting_poll_options";
  await ctx.reply("Question set. Now send the poll options.");
});

export default composer;