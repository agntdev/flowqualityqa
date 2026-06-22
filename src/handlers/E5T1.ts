import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.on("callback_query", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data && (data.startsWith("vote:opt:") || data.startsWith("poll:close:"))) {
    return next();
  }
  await ctx.answerCallbackQuery({
    text: "Action no longer available",
    show_alert: true,
  });
});

export default composer;
