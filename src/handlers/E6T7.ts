import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

async function isAuthorized(
  ctx: Ctx,
  userId: number,
  chatId: number,
  creatorUserId: number,
): Promise<boolean> {
  if (userId === creatorUserId) return true;
  try {
    const admins = await ctx.api.getChatAdministrators(chatId);
    return admins.some((a) => a.user.id === userId);
  } catch {
    return false;
  }
}

composer.callbackQuery(/^perm:close:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  const parts = data.split(":");
  if (parts.length < 4) {
    await ctx.answerCallbackQuery();
    return;
  }
  const creatorUserId = parseInt(parts[2], 10);
  const pollId = parts.slice(3).join(":");
  const msg = ctx.callbackQuery.message;
  const userId = ctx.from!.id;
  const chatId = msg?.chat.id;

  if (isNaN(creatorUserId) || !pollId || chatId == null) {
    await ctx.answerCallbackQuery();
    return;
  }

  const authorized = await isAuthorized(ctx, userId, chatId, creatorUserId);
  if (!authorized) {
    await ctx.answerCallbackQuery({
      text: "Only the poll creator or a chat admin can close this poll.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Permission granted. Use Close poll button.", show_alert: false });
});

composer.callbackQuery(/^perm:export:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  const parts = data.split(":");
  if (parts.length < 4) {
    await ctx.answerCallbackQuery();
    return;
  }
  const creatorUserId = parseInt(parts[2], 10);
  const pollId = parts.slice(3).join(":");
  const msg = ctx.callbackQuery.message;
  const userId = ctx.from!.id;
  const chatId = msg?.chat.id;

  if (isNaN(creatorUserId) || !pollId || chatId == null) {
    await ctx.answerCallbackQuery();
    return;
  }

  const authorized = await isAuthorized(ctx, userId, chatId, creatorUserId);
  if (!authorized) {
    await ctx.answerCallbackQuery({
      text: "Only the poll creator or a chat admin can export this poll.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery({ text: "Permission granted. Use Export button.", show_alert: false });
});

export default composer;