import { readFileSync } from "fs";
import { buildBot } from "./dist/bot.js";
import { getInMemoryClient } from "./dist/store/redis.js";

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

const bot = await buildBot("test-token");
bot.botInfo = { id: 42, is_bot: true, first_name: "Test", username: "test", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

// Add generic middleware at the END
bot.use(async (ctx, next) => {
  console.log("[GEN] fired. update keys:", Object.keys(ctx.update));
  await next();
});

const calls = [];
bot.api.config.use(async (_prev, method, payload) => {
  calls.push({ method });
  return { ok: true, result: {} };
});

// POLL FIRST
console.log("=== POLL first ===");
try {
  await bot.handleUpdate({
    update_id: 1,
    poll: { id: "poll_test", question: "Test?", is_closed: true, options: [{text:"A"}], total_voter_count: 3, is_anonymous: true, type: "regular", allows_multiple_answers: false }
  });
} catch(e) { console.error("handleUpdate threw:", e); }
await new Promise(r => setTimeout(r, 100));
console.log("Poll calls:", calls.map(c=>c.method).join(",")||"none");
calls.length = 0;

// THEN TEXT
console.log("\n=== TEXT second ===");
try {
  await bot.handleUpdate({
    update_id: 2,
    message: { message_id: 2, date: 0, chat: { id: 1, type: "private", first_name: "T" }, from: { id: 1, is_bot: false, first_name: "T" }, text: "/help" }
  });
} catch(e) { console.error("handleUpdate threw:", e); }
await new Promise(r => setTimeout(r, 100));
console.log("Text calls:", calls.map(c=>c.method).join(",")||"none");
