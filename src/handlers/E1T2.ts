import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_poll_question") return next();

  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return next();

  if (!text) {
    await ctx.reply("Question cannot be empty. Please enter a poll question:");
    return;
  }

  ctx.session.poll!.question = text;
  ctx.session.step = "awaiting_option_text";
  await ctx.reply("Question set. Send option 1.", {
    reply_markup: inlineKeyboard([[inlineButton("Cancel", "option:cancel")]]),
  });
});

export default composer;
