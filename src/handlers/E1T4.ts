import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { buildOptionsText, buildOptionsKeyboard } from "./E1T3.js";
import { PollStore, type Poll } from "../store/poll.js";
import { OptionStore, type Option } from "../store/option.js";

const pollStore = new PollStore();
const optionStore = new OptionStore();

const composer = new Composer<Ctx>();

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildPreviewText(question: string, options: string[], anonymous: boolean): string {
  const type = anonymous ? "Anonymous" : "Public";
  let text = "<b>\u{1F4CB} Poll Preview</b>\n\n";
  text += `<b>Question:</b> ${escapeHtml(question)}\n`;
  text += `<b>Type:</b> ${type}\n\n`;
  if (options.length > 0) {
    text += "<b>Options:</b>\n";
    for (let i = 0; i < options.length; i++) {
      text += `  ${i + 1}. ${escapeHtml(options[i])}\n`;
    }
  }
  return text;
}

export function buildPreviewKeyboard(anonymous: boolean) {
  const anonLabel = anonymous ? "\u{1F464} Anonymous: ON" : "\u{1F464} Anonymous: OFF";
  return inlineKeyboard([
    [inlineButton("\u{1F4E4} Post poll", "poll:post")],
    [inlineButton("\u270F\uFE0F Edit options", "poll:edit")],
    [inlineButton(anonLabel, "poll:anon")],
    [inlineButton("Cancel", "poll:cancel")],
  ]);
}

composer.callbackQuery("poll:post", async (ctx) => {
  const poll = ctx.session.poll;
  if (!poll?.question) return;
  if (!ctx.chat?.id) return;

  const options = (poll.options ?? []) as string[];
  if (options.length < 2) {
    await ctx.answerCallbackQuery({ text: "Need at least 2 options.", show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();

  const anonymous = poll.anonymous ?? true;
  const chatId = ctx.chat.id;
  const sent = await ctx.api.sendPoll(chatId, poll.question, options, {
    is_anonymous: anonymous,
  });

  const pollId = sent.poll?.id ?? `poll_${chatId}_${sent.message_id}`;

  const pollRecord: Poll = {
    id: pollId,
    chat_id: chatId,
    message_id: sent.message_id,
    creator_user_id: ctx.from!.id,
    question: poll.question,
    is_anonymous: anonymous,
    is_closed: false,
    created_at: new Date().toISOString(),
    closed_at: null,
  };

  await pollStore.create(pollRecord);

  for (let i = 0; i < options.length; i++) {
    const optionId = `${pollId}_opt_${i}`;
    const option: Option = {
      id: optionId,
      poll_id: pollId,
      text: options[i],
      position: i,
    };
    await optionStore.create(option);
  }

  await ctx.editMessageText("\u2705 Poll posted!", {
    reply_markup: { inline_keyboard: [] },
  });

  ctx.session.step = undefined;
  ctx.session.poll = undefined;
});

composer.callbackQuery("poll:edit", async (ctx) => {
  await ctx.answerCallbackQuery();

  const poll = ctx.session.poll;
  if (!poll?.question) return;

  ctx.session.step = "awaiting_poll_options";

  const options = (poll.options ?? []) as string[];
  const anonymous = poll.anonymous ?? true;

  const msg = ctx.callbackQuery.message;
  if (msg) {
    (poll as Record<string, unknown>).builderMessageId = msg.message_id;
    (poll as Record<string, unknown>).builderChatId = msg.chat.id;
  }

  await ctx.editMessageText(
    buildOptionsText(poll.question, options, anonymous),
    {
      parse_mode: "HTML",
      reply_markup: buildOptionsKeyboard(options, anonymous),
    },
  );
});

composer.callbackQuery("poll:anon", async (ctx) => {
  await ctx.answerCallbackQuery();

  const poll = ctx.session.poll;
  if (!poll?.question) return;

  poll.anonymous = !(poll.anonymous ?? true);

  const options = (poll.options ?? []) as string[];
  const anonymous = poll.anonymous;

  await ctx.editMessageText(
    buildPreviewText(poll.question, options, anonymous),
    {
      parse_mode: "HTML",
      reply_markup: buildPreviewKeyboard(anonymous),
    },
  );
});

composer.callbackQuery("poll:cancel", async (ctx) => {
  await ctx.answerCallbackQuery();

  ctx.session.step = undefined;
  ctx.session.poll = undefined;

  await ctx.editMessageText("Poll creation cancelled.");
});

export default composer;