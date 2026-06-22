import { Bot } from "grammy";
import { getInMemoryClient } from "./dist/store/redis.js";
import { buildBot } from "./dist/bot.js";

const client = getInMemoryClient();
await client.set("poll:poll_test", JSON.stringify({
  id: "poll_test", chat_id: 1, message_id: 1001, creator_user_id: 1,
  question: "Test?", is_anonymous: true, is_closed: false,
  created_at: "2024-01-01T00:00:00Z", closed_at: null
}));
await client.sadd("opt:poll:poll_test", "poll_test_opt_0");
await client.set("opt:poll_test_opt_0", JSON.stringify({
  id: "poll_test_opt_0", poll_id: "poll_test", text: "A", position: 0
}));

// Create bot WITHOUT session
const bot = new Bot("test-token");
bot.botInfo = { id: 42, is_bot: true, first_name: "Test", username: "test", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

bot.use(async (ctx, next) => {
  console.log("GEN: update keys:", Object.keys(ctx.update));
  await next();
});

// Use same handler that buildBot would load - just E5T3 composer
const E5T3Module = await import("./dist/handlers/E5T3.js");
bot.use(E5T3Module.default);

const calls = [];
bot.api.config.use(async (_prev, method, payload) => {
  const p = (payload ?? {});
  calls.push({ method, payload: p });
  console.log("API:", method);
  return { ok: true, result: {} };
});

console.log("=== POLL ===");
await bot.handleUpdate({
  update_id: 10,
  poll: { id: "poll_test", question: "Test?", is_closed: true, options: [{text: "A"}], total_voter_count: 3, is_anonymous: true, type: "regular", allows_multiple_answers: false }
});
await new Promise(r => setTimeout(r, 200));
console.log("Calls:", calls.map(c => c.method).join(", ") || "none");

calls.length = 0;
console.log("\n=== POLL_ANSWER ===");
await bot.handleUpdate({
  update_id: 11,
  poll_answer: { poll_id: "poll_test", voter_chat: { id: 789, type: "private" }, user: { id: 789, is_bot: false, first_name: "Voter" }, option_ids: [0] }
});
await new Promise(r => setTimeout(r, 200));
console.log("Calls:", calls.map(c => c.method).join(", ") || "none");
