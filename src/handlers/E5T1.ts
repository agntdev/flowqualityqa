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

composer.on("callback_query", async (ctx) => {
  const data = ctx.callbackQuery.data;
  if (data && KNOWN_PREFIXES.some((prefix) => data.startsWith(prefix))) return;

  await ctx.answerCallbackQuery({
    text: "Action no longer available",
    show_alert: true,
  });
});

export default composer;
