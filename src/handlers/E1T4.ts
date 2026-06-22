import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";
import { buildOptionsText, buildOptionsKeyboard, buildPreviewText, buildPreviewKeyboard } from "../shared/poll-helpers.js";
import { PollStore, type Poll } from "../store/poll.js";
import { OptionStore, type Option } from "../store/option.js";

const pollStore = new PollStore();
const optionStore = new OptionStore();

const composer = new Composer<Ctx>();

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
    reply_markup: inlineKeyboard([
      [inlineButton("Close poll", `poll:close:${ctx.from!.id}:${sent.message_id}:${pollId}`)],
      [inlineButton("Export", `poll:export:${pollId}`)],
    ]),
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