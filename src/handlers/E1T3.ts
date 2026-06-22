import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildOptionsText(question: string, options: string[], anonymous: boolean): string {
  const type = anonymous ? "Anonymous" : "Public";
  let text = `<b>Poll:</b> ${escapeHtml(question)}\n`;
  text += `<b>Type:</b> ${type}\n\n`;
  if (options.length > 0) {
    text += "<b>Options:</b>\n";
    for (let i = 0; i < options.length; i++) {
      text += `  ${i + 1}. ${escapeHtml(options[i])}\n`;
    }
  } else {
    text += "No options yet.\n";
  }
  text += `\n${options.length}/5 options (need 2–5)`;
  return text;
}

function buildOptionsKeyboard(options: string[], anonymous: boolean) {
  const rows: ReturnType<typeof inlineButton>[][] = [];

  if (options.length < 5) {
    rows.push([inlineButton("Add option", "option:add")]);
  }

  if (options.length >= 2) {
    rows.push([inlineButton("Done", "option:done")]);
  }

  const anonLabel = anonymous ? "Anonymous: ON" : "Anonymous: OFF";
  rows.push([inlineButton(anonLabel, "option:anon")]);
  rows.push([inlineButton("Cancel", "option:cancel")]);

  return inlineKeyboard(rows);
}

async function showBuilder(ctx: Ctx, poll: NonNullable<Ctx["session"]["poll"]>) {
  const options = poll.options ?? [];
  const anonymous = poll.anonymous ?? true;

  const msg = await ctx.reply(buildOptionsText(poll.question!, options, anonymous), {
    parse_mode: "HTML",
    reply_markup: buildOptionsKeyboard(options, anonymous),
  });

  poll.builderMessageId = msg.message_id;
  poll.builderChatId = msg.chat.id;
}

async function editBuilder(ctx: Ctx) {
  const poll = ctx.session.poll;
  if (!poll?.question) return;

  const msgId = poll.builderMessageId;
  const chatId = poll.builderChatId;
  if (!msgId || !chatId) return;

  const options = poll.options ?? [];
  const anonymous = poll.anonymous ?? true;

  try {
    await ctx.api.editMessageText(
      chatId,
      msgId,
      buildOptionsText(poll.question, options, anonymous),
      {
        parse_mode: "HTML",
        reply_markup: buildOptionsKeyboard(options, anonymous),
      },
    );
  } catch {
    await showBuilder(ctx, poll);
  }
}

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step === "awaiting_poll_options") {
    ctx.session.step = "awaiting_option_text";
  }
  if (ctx.session.step !== "awaiting_option_text") return next();

  const poll = ctx.session.poll;
  if (!poll?.question) return next();

  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return next();

  if (!text) {
    await ctx.reply("Option cannot be empty. Please enter a non-empty option:");
    return;
  }

  const options = poll.options ?? [];
  if (options.length >= 5) {
    await ctx.reply("This poll already has 5 options. Tap Done or Cancel.");
    await editBuilder(ctx);
    return;
  }

  options.push(text);
  poll.options = options;

  if (poll.builderMessageId) {
    await editBuilder(ctx);
  } else {
    await showBuilder(ctx, poll);
  }
});

composer.callbackQuery("option:add", async (ctx) => {
  const options = ctx.session.poll?.options ?? [];

  if (options.length >= 5) {
    await ctx.answerCallbackQuery({ text: "Maximum 5 options.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_option_text";

  const builderMessage = ctx.callbackQuery.message;
  const poll = ctx.session.poll;
  if (builderMessage && poll) {
    poll.builderMessageId = builderMessage.message_id;
    poll.builderChatId = builderMessage.chat.id;
  }

  await ctx.editMessageText(`Enter option ${options.length + 1}:`, {
    reply_markup: inlineKeyboard([[inlineButton("Cancel", "option:cancel")]]),
  });
});

composer.callbackQuery("option:done", async (ctx) => {
  const poll = ctx.session.poll;
  if (!poll?.question) return;

  const options = poll.options ?? [];
  if (options.length < 2) {
    await ctx.answerCallbackQuery({ text: "Need at least 2 options.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const anonymous = poll.anonymous ?? true;
  const chatId = ctx.callbackQuery.message?.chat.id;
  if (!chatId) {
    await ctx.answerCallbackQuery({ text: "Action no longer available", show_alert: true });
    return;
  }

  await ctx.api.sendPoll(chatId, poll.question, options, {
    is_anonymous: anonymous,
  });
  await ctx.editMessageText("Poll posted.");

  ctx.session.step = undefined;
  ctx.session.poll = undefined;
});

composer.callbackQuery("option:anon", async (ctx) => {
  await ctx.answerCallbackQuery();

  const poll = ctx.session.poll;
  if (!poll?.question) return;

  poll.anonymous = !(poll.anonymous ?? true);

  const options = poll.options ?? [];
  await ctx.editMessageText(
    buildOptionsText(poll.question, options, poll.anonymous),
    {
      parse_mode: "HTML",
      reply_markup: buildOptionsKeyboard(options, poll.anonymous),
    },
  );
});

composer.callbackQuery("option:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();

  ctx.session.step = undefined;
  ctx.session.poll = undefined;

  await ctx.editMessageText("Poll creation cancelled.");
});

export default composer;
