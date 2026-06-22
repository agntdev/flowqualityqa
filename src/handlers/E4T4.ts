import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getRedisClient } from "../store/redis.js";

const ADMIN_SET_KEY = "bot:admins";

const raw = process.env.BOT_ADMIN_IDS?.trim() ?? "";
const BOT_ADMIN_IDS: number[] = raw
  ? raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0)
  : [];

// Seed initial admin IDs from env var into persistent storage on startup
if (BOT_ADMIN_IDS.length > 0) {
  const redis = getRedisClient();
  if (redis) {
    for (const id of BOT_ADMIN_IDS) {
      redis.sadd(ADMIN_SET_KEY, String(id)).catch(() => {});
    }
  }
}

export async function isAdmin(userId: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;
  const members = await redis.smembers(ADMIN_SET_KEY);
  return members.includes(String(userId));
}

export async function getAdminIds(): Promise<number[]> {
  const redis = getRedisClient();
  if (!redis) return [];
  const members = await redis.smembers(ADMIN_SET_KEY);
  return members.map((m) => Number(m)).filter((n) => !isNaN(n) && n > 0);
}

const composer = new Composer<Ctx>();

composer.command("admins", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId !== undefined && (await isAdmin(userId))) {
    const ids = (await getAdminIds()).join(", ");
    await ctx.reply(ids ? `Admin IDs: ${ids}` : "No admin IDs configured.");
  } else {
    await ctx.reply("Access denied.");
  }
});

export default composer;
