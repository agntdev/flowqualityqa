import { buildBot } from "./dist/bot.js";
import { getInMemoryClient } from "./dist/store/redis.js";

const client = getInMemoryClient();
await client.set("poll:poll_closed_1", JSON.stringify({
  id: "poll_closed_1", chat_id: 1, message_id: 1001, creator_user_id: 1,
  question: "Test?", is_anonymous: true, is_closed: false,
  created_at: "2024-01-01T00:00:00Z", closed_at: null
}));
await client.sadd("opt:poll:poll_closed_1", "poll_closed_1_opt_0");
await client.set("opt:poll_closed_1_opt_0", JSON.stringify({
  id: "poll_closed_1_opt_0", poll_id: "poll_closed_1", text: "A", position: 0
}));
await client.sadd("poll:chat:1", "poll_closed_1");

const bot = await buildBot("test-token");
bot.botInfo = { id: 42, is_bot: true, first_name: "Test", username: "test", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

const calls = [];
bot.api.config.use(async (_prev, method, payload) => {
  calls.push({ method, payload: (payload ?? {}) });
  console.log("API:", method);
  return { ok: true, result: {} };
});

console.log("=== Sending poll update ===");
await bot.handleUpdate({
  update_id: 10,
  poll: {
    id: "poll_closed_1", question: "Test?", is_closed: true,
    options: [{text:"A"}, {text:"B"}], total_voter_count: 3, is_anonymous: true,
    type: "regular", allows_multiple_answers: false
  }
});
await new Promise(r => setTimeout(r, 200));
console.log("Calls:", calls.map(c=>c.method).join(",")||"none");
