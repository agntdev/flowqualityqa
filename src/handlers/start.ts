import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const WELCOME = `Welcome to FlowQualityQABot!

Create quick team polls with buttons.`;

composer.command("start", async (ctx) => {
  await ctx.reply(WELCOME, {
    reply_markup: inlineKeyboard([
      [inlineButton("Create poll", "menu:poll")],
      [inlineButton("About", "menu:about"), inlineButton("Help", "menu:help")],
    ]),
  });
});

composer.callbackQuery("menu:about", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "FlowQualityQABot helps teams create quick Telegram polls and collect votes.",
  );
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Use Create poll to start a poll. Send /start to return to the main menu.",
  );
});

export default composer;
