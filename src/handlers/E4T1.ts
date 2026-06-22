import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { PollStore, type Poll } from "../store/poll.js";

const store = new PollStore();

const composer = new Composer<Ctx>();

function parsePollArgs(text: string): { question: string; options: string[]; isAnonymous: boolean } {
  let content = text.trim();
  let isAnonymous = true;

  const publicFlag = /\s--public\b/.exec(content);
  if (publicFlag) {
    isAnonymous = false;
    content = content.slice(0, publicFlag.index) + content.slice(publicFlag.index + publicFlag[0].length);
  }

  const parts = content.split("|").map((p) => p.trim()).filter((p) => p.length > 0);
  if (parts.length < 2) {
    return { question: content, options: [], isAnonymous };
  }
  const question = parts[0];
  const options = parts.slice(1);
  return { question, options, isAnonymous };
}

composer.command("poll", async (ctx) => {
  const raw = ctx.match ?? ctx.message?.text?.replace(/^\/poll\s*/, "") ?? "";
  if (!raw.trim()) {
    await ctx.reply("Usage: /poll \"Question\" | \"Option A\" | \"Option B\"");
    return;
  }

  const { question, options, isAnonymous } = parsePollArgs(raw);

  if (options.length < 2) {
    await ctx.reply("A poll needs at least 2 options. Separate them with |");
    return;
  }

  if (options.length > 10) {
    await ctx.reply("A poll can have at most 10 options.");
    return;
  }

  const sent = await ctx.api.sendPoll(ctx.chat.id, question, options, {
    is_anonymous: isAnonymous,
  });

  const id = sent.poll?.id ?? `poll_${ctx.chat.id}_${sent.message_id}`;

  const poll: Poll = {
    id,
    chat_id: ctx.chat.id,
    message_id: sent.message_id,
    creator_user_id: ctx.from!.id,
    question,
    is_anonymous: isAnonymous,
    is_closed: false,
    created_at: new Date().toISOString(),
    closed_at: null,
  };

  await store.create(poll);

  await ctx.reply(
    `Poll created (ID: ${id}). It will close automatically when Telegram closes the poll.`,
  );
});

composer.on("poll", async (ctx, next) => {
  const pollUpdate = ctx.update.poll;
  if (!pollUpdate || !pollUpdate.id) return;

  if (pollUpdate.is_closed) {
    await store.close(pollUpdate.id, new Date().toISOString());
  }

  await next();
});

export default composer;
