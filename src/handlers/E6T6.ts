import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

function validateAnonymousCsv(lines: string[]): string[] {
  const issues: string[] = [];

  if (lines.length === 0) {
    issues.push("CSV is empty.");
    return issues;
  }

  const header = lines[0].trim();
  if (header !== "Option,Votes") {
    issues.push(`Expected header "Option,Votes" but got "${header}"`);
  }

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      issues.push(`Row ${i}: empty line`);
      continue;
    }
    const fields = parseCsvLine(trimmed);
    if (fields.length !== 2) {
      issues.push(`Row ${i}: expected 2 columns but got ${fields.length}`);
      continue;
    }
    if (!fields[0]) {
      issues.push(`Row ${i}: option name is empty`);
    }
    const votes = Number(fields[1]);
    if (!Number.isInteger(votes) || votes < 0) {
      issues.push(`Row ${i}: vote count must be a non-negative integer, got "${fields[1]}"`);
    }
  }

  return issues;
}

function validatePublicCsv(lines: string[]): string[] {
  const issues: string[] = [];

  if (lines.length === 0) {
    issues.push("CSV is empty.");
    return issues;
  }

  const header = lines[0].trim();
  if (header !== "Option,Votes,Voter") {
    issues.push(`Expected header "Option,Votes,Voter" but got "${header}"`);
  }

  for (let i = 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      issues.push(`Row ${i}: empty line`);
      continue;
    }
    const fields = parseCsvLine(trimmed);
    if (fields.length !== 3) {
      issues.push(`Row ${i}: expected 3 columns but got ${fields.length}`);
      continue;
    }
    if (!fields[0]) {
      issues.push(`Row ${i}: option name is empty`);
    }
    if (fields[1] !== "1") {
      issues.push(`Row ${i}: vote column must be "1" for public polls, got "${fields[1]}"`);
    }
    if (!fields[2]) {
      issues.push(`Row ${i}: voter ID is missing`);
      continue;
    }
    const voter = Number(fields[2]);
    if (!Number.isInteger(voter) || voter < 0) {
      issues.push(`Row ${i}: voter ID must be a non-negative integer, got "${fields[2]}"`);
    }
  }

  return issues;
}

composer.command("csvcheck", async (ctx) => {
  const arg = ctx.message!.text.split(/\s+/).slice(1).join(" ").trim().toLowerCase();

  if (arg !== "anonymous" && arg !== "public") {
    await ctx.reply(
      "Usage: /csvcheck anonymous|public\n\nTells the bot which poll type to validate against. Then send the CSV content.",
    );
    return;
  }

  ctx.session.step = "csvcheck_awaiting_csv";
  ctx.session.poll = { anonymous: arg === "public" ? false : true };
  await ctx.reply(
    `Send the CSV to validate (expected format: ${arg === "anonymous" ? "Option,Votes" : "Option,Votes,Voter"}):`,
  );
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "csvcheck_awaiting_csv") return next();

  const csv = ctx.message.text;
  const anonymous = ctx.session.poll?.anonymous ?? true;

  const allLines = csv.split("\n");

  let issues: string[];
  if (anonymous) {
    issues = validateAnonymousCsv(allLines);
  } else {
    issues = validatePublicCsv(allLines);
  }

  ctx.session.step = undefined;
  ctx.session.poll = undefined;

  if (issues.length === 0) {
    await ctx.reply(
      `CSV format is valid for ${anonymous ? "anonymous" : "public"} poll.`,
    );
  } else {
    await ctx.reply(
      `CSV format is invalid for ${anonymous ? "anonymous" : "public"} poll:\n${issues.join("\n")}`,
    );
  }
});

export default composer;
