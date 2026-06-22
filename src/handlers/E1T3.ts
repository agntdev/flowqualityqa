import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { buildOptionsText, buildOptionsKeyboard, buildPreviewText, buildPreviewKeyboard } from "../shared/poll-helpers.js";

const composer = new Composer<Ctx>();

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