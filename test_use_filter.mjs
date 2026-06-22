import { Bot } from "grammy";

const bot = new Bot("test");
bot.botInfo = { id: 42, is_bot: true, first_name: "T", username: "t" };

// Test: composer.on("poll") approach
const composer1 = new (await import("grammy")).Composer();
composer1.on("poll", async (ctx) => {
  console.log("composer1.on('poll') fired!");
});
bot.use(composer1);

// Test: composer.use() approach
const composer2 = new (await import("grammy")).Composer();
composer2.use(async (ctx, next) => {
  if (ctx.update.poll) {
    console.log("composer2.use() fired! poll:", !!ctx.update.poll);
  }
  await next();
});
bot.use(composer2);

const calls = [];
bot.api.config.use(async (_prev, method, payload) => {
  calls.push(method);
  return { ok: true, result: {} };
});

await bot.handleUpdate({
  update_id: 1,
  poll: { id: "p1", question: "Q?", is_closed: true, options: [{text:"A"}], total_voter_count: 0, is_anonymous: true, type: "regular", allows_multiple_answers: false }
});
await new Promise(r => setTimeout(r, 100));
console.log("Calls:", calls.join(",") || "none");
