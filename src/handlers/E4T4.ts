import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { getRedisClient } from "../store/redis.js";

const ADMIN_KEY = "admin:ids";
const envRaw = process.env.BOT_ADMIN_IDS?.trim() ?? "";

let seeded = false;
async function ensureSeeded(): Promise<void> {
  if (seeded) return;
  seeded = true;
  const client = getRedisClient();
  if (!client) return;

  const existing = await client.smembers(ADMIN_KEY);
  if (existing.length > 0) return;

  if (!envRaw) return;

  const ids = envRaw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => !isNaN(n) && n > 0);
  if (ids.length === 0) return;

  await client.sadd(ADMIN_KEY, ...ids.map(String));
}

export async function isAdmin(userId: number): Promise<boolean> {
  await ensureSeeded();
  const client = getRedisClient();
  if (!client) return false;
  const raw = await client.get(`admin:user:${userId}`);
  if (raw) return true;
  return (await client.smembers(ADMIN_KEY)).includes(String(userId));
}

export async function getAdminIds(): Promise<number[]> {
  await ensureSeeded();
  const client = getRedisClient();
  if (!client) return [];
  const members = await client.smembers(ADMIN_KEY);
  return members.map(Number).filter((n) => !isNaN(n) && n > 0);
}

const composer = new Composer<Ctx>();

composer.command("admins", async (ctx) => {
  const userId = ctx.from?.id;
  if (userId !== undefined && await isAdmin(userId)) {
    const ids = (await getAdminIds()).join(", ");
    await ctx.reply(ids ? `Admin IDs: ${ids}` : "No admin IDs configured.");
  } else {
    await ctx.reply("Access denied.");
  }
});

export default composer;
