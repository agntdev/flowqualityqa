import { Bot, Composer } from "grammy";
import { createBot } from "./dist/toolkit/index.js";

// Create bot similar to createBot but with custom error handler
const bot = createBot("test-token", {
  initial: () => ({}),
  onError: (err) => { console.error("[CUSTOM ERROR]", err); }
});

bot.botInfo = { id: 42, is_bot: true, first_name: "Test", username: "test", can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false };

let genFired = false;
bot.use(async (ctx, next) => {
  genFired = true;
  console.log("[GEN] update keys:", Object.keys(ctx.update));
  await next();
});

const calls = [];
bot.api.config.use(async (_prev, method, payload) => {
  calls.push({ method });
  return { ok: true, result: {} };
});

console.log("=== SENDING POLL ===");
try {
  await bot.handleUpdate({
    update_id: 1,
    poll: { id: "test", question: "Q?", is_closed: true, options: [{text:"A"}], total_voter_count: 0, is_anonymous: true, type: "regular", allows_multiple_answers: false, poll_id: "test" }
  });
  console.log("handleUpdate returned normally");
} catch(e) {
  console.error("handleUpdate THREW:", e);
}
await new Promise(r => setTimeout(r, 100));
console.log("[GEN] fired:", genFired);
console.log("Calls:", calls.map(c=>c.method).join(",")||"none");
