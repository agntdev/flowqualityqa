import { runSpec } from "./dist/toolkit/harness/runner.js";

const mod = await import("./dist/harness-entry.js");
const makeBot = mod.makeBot ?? mod.default;
const bot = await makeBot();

const fakeBotInfo = {
  id: 42,
  is_bot: true,
  first_name: "TestBot",
  username: "test_bot",
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

bot.botInfo = fakeBotInfo;
console.log("botInfo set");

const result = await runSpec(bot, {
  name: "debug",
  steps: [
    {
      send: { callback: "perm:close:1:poll_1", userId: 1, messageId: 100 },
      expect: []
    }
  ]
});
console.log("result:", JSON.stringify(result, null, 2));