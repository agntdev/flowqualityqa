import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.callbackQuery("menu:poll", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_poll_question";
  ctx.session.poll = { options: [], anonymous: true };
  await ctx.editMessageText("Enter a poll question:");
});

export default composer;