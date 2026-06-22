import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const raw = process.env.BOT_ADMIN_IDS?.trim() ?? "";
const BOT_ADMIN_IDS: number[] = raw
  ? raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0)
  : [];

const adminSet = new Set(BOT_ADMIN_IDS);

export function isAdmin(userId: number): boolean {
  return adminSet.has(userId);
}

export function getAdminIds(): number[] {
  return [...adminSet];
}

const composer = new Composer<Ctx>();

composer.command("admins", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId !== undefined && isAdmin(userId)) {
    const ids = getAdminIds().join(", ");
    await ctx.reply(ids ? `Admin IDs: ${ids}` : "No admin IDs configured.");
  } else {
    await ctx.reply("Access denied.");
  }
});

export default composer;
