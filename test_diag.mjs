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

// Test 1: buildBot (with session)
console.log("=== buildBot (with session) ===");
const bot1 = await buildBot("test-token");
bot1.botInfo = { id: 42, is_bot: true, first_name: "Test", username: "test", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

bot1.use(async (ctx, next) => {
  console.log("[buildBot] GEN middleware hit! keys:", Object.keys(ctx.update));
  await next();
});

const calls1 = [];
bot1.api.config.use(async (_prev, method, payload) => {
  calls1.push({ method });
  return { ok: true, result: {} };
});

await bot1.handleUpdate({
  update_id: 1,
  message: { message_id: 1, date: 0, chat: { id: 1, type: "private", first_name: "T" }, from: { id: 1, is_bot: false, first_name: "T" }, text: "/help" }
});
console.log("Text calls:", calls1.map(c=>c.method).join(","));
calls1.length = 0;

await bot1.handleUpdate({
  update_id: 2,
  poll: { id: "poll_test", question: "Test?", is_closed: true, options: [{text:"A"}], total_voter_count: 3, is_anonymous: true, type: "regular", allows_multiple_answers: false }
});
await new Promise(r => setTimeout(r, 100));
console.log("Poll calls:", calls1.map(c=>c.method).join(",")||"none");
