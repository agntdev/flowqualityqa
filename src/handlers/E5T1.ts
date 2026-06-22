import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.on("callback_query", async (ctx) => {
  await ctx.answerCallbackQuery({
    text: "Action no longer available",
    show_alert: true,
  });
});

export default composer;
