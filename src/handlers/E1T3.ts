import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { buildPreviewText, buildPreviewKeyboard } from "./E1T4.js";

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildOptionsText(question: string, options: string[], anonymous: boolean): string {
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

export function buildOptionsKeyboard(options: string[], anonymous: boolean) {
  const rows: ReturnType<typeof inlineButton>[][] = [];

  rows.push([inlineButton("\u2795 Add option", "option:add")]);

  if (options.length >= 2) {
    rows.push([inlineButton("\u2705 Done", "option:done")]);
  }

  const anonLabel = anonymous ? "\u{1F464} Anonymous: ON" : "\u{1F464} Anonymous: OFF";
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

  (poll as Record<string, unknown>).builderMessageId = msg.message_id;
  (poll as Record<string, unknown>).builderChatId = msg.chat.id;
}

async function editBuilder(ctx: Ctx) {
  const poll = ctx.session.poll as Record<string, unknown> | undefined;
  if (!poll || typeof poll.question !== "string") return;

  const msgId = poll.builderMessageId as number | undefined;
  const chatId = poll.builderChatId as number | undefined;
  if (!msgId || !chatId) return;

  const options = (poll.options ?? []) as string[];
  const anonymous = (poll.anonymous ?? true) as boolean;

  await ctx.api.editMessageText(
    chatId,
    msgId,
    buildOptionsText(poll.question as string, options, anonymous),
    {
      parse_mode: "HTML",
      reply_markup: buildOptionsKeyboard(options, anonymous),
    },
  );
}

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_poll_options") return next();
  const poll = ctx.session.poll;
  if (!poll?.question) return next();
  if ((poll as Record<string, unknown>).builderMessageId) return next();

  await showBuilder(ctx, poll);
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_option_text") return next();

  const poll = ctx.session.poll as Record<string, unknown> | undefined;
  if (!poll || typeof poll.question !== "string") return next();

  const text = ctx.message.text.trim();

  if (!text) {
    await ctx.reply("Option cannot be empty. Please enter a non-empty option:");
    return;
  }

  const options = (poll.options ?? []) as string[];
  if (options.length >= 5) {
    ctx.session.step = "awaiting_poll_options";
    await editBuilder(ctx);
    return;
  }

  const lower = text.toLowerCase();
  if (options.some((o: string) => o.toLowerCase() === lower)) {
    await ctx.reply("This option already exists. Please enter a different option:");
    return;
  }

  options.push(text);
  poll.options = options;
  ctx.session.step = "awaiting_poll_options";

  await editBuilder(ctx);
});

composer.callbackQuery("option:add", async (ctx) => {
  const options = (ctx.session.poll?.options ?? []) as string[];

  if (options.length >= 5) {
    await ctx.answerCallbackQuery({ text: "Maximum 5 options.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  ctx.session.step = "awaiting_option_text";

  const builderMessage = ctx.callbackQuery.message;
  if (builderMessage) {
    const poll = ctx.session.poll as Record<string, unknown>;
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

  const options = (poll.options ?? []) as string[];
  if (options.length < 2) {
    await ctx.answerCallbackQuery({ text: "Need at least 2 options.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const anonymous = poll.anonymous ?? true;
  const previewText = buildPreviewText(poll.question, options, anonymous);
  const previewKb = buildPreviewKeyboard(anonymous);

  await ctx.editMessageText(previewText, {
    parse_mode: "HTML",
    reply_markup: previewKb,
  });

  ctx.session.step = "previewing";
});

composer.callbackQuery("option:anon", async (ctx) => {
  await ctx.answerCallbackQuery();

  const poll = ctx.session.poll;
  if (!poll) return;

  poll.anonymous = !(poll.anonymous ?? true);

  const options = (poll.options ?? []) as string[];
  await ctx.editMessageText(
    buildOptionsText(poll.question!, options, poll.anonymous),
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