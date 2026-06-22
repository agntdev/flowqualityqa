import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { PollStore } from "../store/poll.js";
import { OptionStore } from "../store/option.js";
import { VoteStore } from "../store/vote.js";

const pollStore = new PollStore();
const optionStore = new OptionStore();
const voteStore = new VoteStore();

const composer = new Composer<Ctx>();

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

async function isAuthorizedCreator(
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

composer.callbackQuery(/^poll:export:/, async (ctx) => {
  const data = ctx.callbackQuery.data;
  const prefix = "poll:export:";
  const pollId = data.slice(prefix.length);
  if (!pollId) {
    await ctx.answerCallbackQuery();
    return;
  }

  const poll = await pollStore.getById(pollId);
  if (!poll) {
    await ctx.answerCallbackQuery({ text: "Poll not found.", show_alert: true });
    return;
  }

  const userId = ctx.from!.id;
  const chatId = poll.chat_id;
  const authorized = await isAuthorizedCreator(ctx, userId, chatId, poll.creator_user_id);
  if (!authorized) {
    await ctx.answerCallbackQuery({
      text: "Only the poll creator or a chat admin can export this poll.",
      show_alert: true,
    });
    return;
  }

  await ctx.answerCallbackQuery();

  const options = await optionStore.listByPoll(pollId);
  const votes = await voteStore.listByPoll(pollId);

  const voteCounts = new Map<string, number>();
  for (const v of votes) {
    voteCounts.set(v.option_id, (voteCounts.get(v.option_id) ?? 0) + 1);
  }

  const rows: string[] = [];

  if (poll.is_anonymous) {
    rows.push("Option,Votes");
    for (const opt of options) {
      const count = voteCounts.get(opt.id) ?? 0;
      rows.push(`${escapeCsvField(opt.text)},${count}`);
    }
  } else {
    rows.push("Option,Votes,Voter");
    for (const opt of options) {
      const optVotes = votes.filter((v) => v.option_id === opt.id);
      if (optVotes.length === 0) {
        rows.push(`${escapeCsvField(opt.text)},0,`);
      } else {
        for (const v of optVotes) {
          rows.push(`${escapeCsvField(opt.text)},1,${v.user_id}`);
        }
      }
    }
  }

  const csv = rows.join("\n");
  const filename = poll.is_anonymous
    ? `poll_${pollId}_anonymous.csv`
    : `poll_${pollId}_public.csv`;

  await ctx.api.sendDocument(
    ctx.from!.id,
    new InputFile(Buffer.from(csv, "utf-8"), filename),
    {
      caption: `Poll export: ${poll.question}`,
    },
  );
});

export default composer;