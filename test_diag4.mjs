import { Bot } from "grammy";
import { readdirSync } from "node:fs";
import { getInMemoryClient } from "./dist/store/redis.js";

const client = getInMemoryClient();
await client.set("poll:poll_test", JSON.stringify({
  id: "poll_test", chat_id: 1, message_id: 1001, creator_user_id: 1,
  question: "Test?", is_anonymous: true, is_closed: false,
  created_at: "2024-01-01T00:00:00Z", closed_at: null
}));
await client.sadd("opt:poll:poll_test", "poll_test_0");
await client.set("opt:poll_test_0", JSON.stringify({
  id: "poll_test_0", poll_id: "poll_test", text: "A", position: 0
}));

// Bot WITHOUT session, but WITH all handlers
const bot = new Bot("test-token");
bot.botInfo = { id: 42, is_bot: true, first_name: "Test", username: "test", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

bot.use(async (ctx, next) => {
  console.log("[GEN] update type:", Object.keys(ctx.update).filter(k => k !== 'update_id'));
  await next();
});

// Load all handlers like buildBot does
const dir = new URL("./dist/handlers/", import.meta.url);
const files = readdirSync(dir).filter(
  f => (f.endsWith(".js") || f.endsWith(".ts")) && !f.endsWith(".d.ts") && !f.includes(".test.") && !f.includes(".spec."),
);
for (const file of files.sort()) {
  const mod = await import(new URL(file, dir).href);
  bot.use(mod.default);
  console.log("  Loaded:", file);
}

bot.on("message", (ctx) => ctx.reply("Sorry..."));

const calls = [];
bot.api.config.use(async (_prev, method, payload) => {
  calls.push({ method });
  return { ok: true, result: {} };
});

console.log("\n=== POLL ===");
await bot.handleUpdate({
  update_id: 1,
  poll: { id: "poll_test", question: "Test?", is_closed: true, options: [{text:"A"}], total_voter_count: 3, is_anonymous: true, type: "regular", allows_multiple_answers: false }
});
await new Promise(r => setTimeout(r, 100));
console.log("Calls:", calls.map(c=>c.method).join(",")||"none");
