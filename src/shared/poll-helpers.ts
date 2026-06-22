import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

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