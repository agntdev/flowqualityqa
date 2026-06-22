import { describe, expect, it } from "vitest";
import { buildBot } from "../src/bot.js";
import { parseBotSpec, runSpecs } from "../src/toolkit/index.js";

describe("poll builder flow", () => {
  it("accepts typed options after the question and posts the poll from a button", async () => {
    const suite = await runSpecs(() => buildBot("test-token"), [
      parseBotSpec({
        name: "create poll with typed options",
        steps: [
          {
            send: { text: "/start" },
            expect: [
              {
                method: "sendMessage",
                payload: {
                  text: "Welcome to FlowQualityQABot!\n\nCreate quick team polls with buttons.",
                },
              },
            ],
          },
          {
            send: { callback: "menu:poll", messageId: 1001 },
            expect: [
              { method: "answerCallbackQuery" },
              { method: "editMessageText", payload: { text: "Enter a poll question:" } },
            ],
          },
          {
            send: { text: "What's color of sky?" },
            expect: [
              { method: "sendMessage", payload: { text: "Question set. Send option 1." } },
            ],
          },
          {
            send: { text: "Blue" },
            expect: [
              {
                method: "sendMessage",
                payload: {
                  text: "<b>Poll:</b> What's color of sky?\n<b>Type:</b> Anonymous\n\n<b>Options:</b>\n  1. Blue\n\n1/5 options (need 2–5)",
                },
              },
            ],
          },
          {
            send: { text: "Green" },
            expect: [
              {
                method: "editMessageText",
                payload: {
                  text: "<b>Poll:</b> What's color of sky?\n<b>Type:</b> Anonymous\n\n<b>Options:</b>\n  1. Blue\n  2. Green\n\n2/5 options (need 2–5)",
                },
              },
            ],
          },
          {
            send: { callback: "option:done", messageId: 1003 },
            expect: [
              { method: "answerCallbackQuery" },
              {
                method: "sendPoll",
                payload: {
                  question: "What's color of sky?",
                  options: [{ text: "Blue" }, { text: "Green" }],
                  is_anonymous: true,
                },
              },
              { method: "editMessageText", payload: { text: "Poll posted." } },
            ],
          },
        ],
      }),
    ]);

    expect(suite.failed).toBe(0);
    expect(suite.passed).toBe(1);
  });
});
