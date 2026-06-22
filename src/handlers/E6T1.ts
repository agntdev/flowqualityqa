import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "previewing") return next();
  await ctx.reply("Use the buttons below to post, edit, or cancel your poll.");
});

export default composer;
