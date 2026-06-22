import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

const KNOWN_PREFIXES = [
  "menu:",
  "option:",
  "poll:",
  "vote:opt:",
  "perm:",
];

composer.on("callback_query", async (ctx, next) => {
  const data = ctx.callbackQuery.data;
  if (data && KNOWN_PREFIXES.some((prefix) => data.startsWith(prefix))) return next();

  await ctx.answerCallbackQuery({
    text: "Action no longer available",
    show_alert: true,
  });
});

export default composer;
