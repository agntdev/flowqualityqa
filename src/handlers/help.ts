import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("help", async (ctx) => {
  await ctx.reply(
    "Use /start to open the button menu. Poll creation uses buttons for actions and text only for the question/options.",
  );
});

export default composer;
