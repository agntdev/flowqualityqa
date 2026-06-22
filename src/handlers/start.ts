import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const WELCOME = `Welcome to AGNTDEV Bot!

Use the menu below to get started.`;

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
    "AGNTDEV Bot — a Telegram bot built with the grammY framework.",
  );
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Use the buttons below to navigate. Send /start to return to the main menu.",
  );
});

export default composer;