import { NextRequest, NextResponse } from "next/server";
import {
  handleLog,
  handleSkip,
  handleSwap,
  handleHelp,
  handleToday,
  handleHrv,
  handleRhr,
  handleSleep,
  handleZones,
  handleLoad,
  handleReport,
  handleRecent,
  handleBackfill,
  handleSetup,
  handleWeight,
  handleWaist,
  handleBody,
  handleStreak,
  handleCalendar,
} from "@/lib/commands";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    date: number;
  };
}

function parsePosInt(raw: string | undefined, def: number): number {
  if (!raw) return def;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const update = (await req.json()) as TelegramUpdate;

  const message = update.message;

  // Ignore updates without a message or text — always 200 so Telegram doesn't retry
  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  // Single-user guard: ignore messages from anyone else silently
  if (String(message.chat.id) !== process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

  const todayDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
  );
  const todayISO = todayDate.toISOString().slice(0, 10);

  const text = message.text.trim();
  // Strip bot username suffix (e.g. /cmd@whoop_trainer_bot → /cmd)
  const normalized = text.replace(/@\S+/, "").trim();
  const parts = normalized.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg1 = parts[1];

  let reply: string;

  if (cmd === "/log" && parts.length > 1) {
    reply = await handleLog(normalized.slice("/log ".length), todayISO);
  } else if (cmd === "/skip") {
    reply = await handleSkip(todayISO);
  } else if (cmd === "/swap" && arg1) {
    reply = await handleSwap(arg1, todayISO);
  } else if (cmd === "/help") {
    reply = await handleHelp();
  } else if (cmd === "/today") {
    reply = await handleToday(todayISO);
  } else if (cmd === "/hrv") {
    reply = await handleHrv(parsePosInt(arg1, 7), todayISO);
  } else if (cmd === "/rhr") {
    reply = await handleRhr(parsePosInt(arg1, 7), todayISO);
  } else if (cmd === "/sleep") {
    reply = await handleSleep(parsePosInt(arg1, 7), todayISO);
  } else if (cmd === "/zones") {
    reply = await handleZones(parsePosInt(arg1, 7), todayISO);
  } else if (cmd === "/load") {
    reply = await handleLoad(todayISO);
  } else if (cmd === "/report") {
    const win = arg1 === "month" ? "month" : arg1 === "year" ? "year" : "week";
    reply = await handleReport(win, todayISO);
  } else if (cmd === "/recent") {
    reply = await handleRecent(parsePosInt(arg1, 5), todayISO);
  } else if (cmd === "/backfill") {
    reply = await handleBackfill();
  } else if (cmd === "/setup") {
    reply = await handleSetup();
  } else if (cmd === "/weight" && arg1) {
    reply = await handleWeight(normalized.slice("/weight ".length), todayISO);
  } else if (cmd === "/weight") {
    reply = await handleWeight("", todayISO);
  } else if (cmd === "/waist" && arg1) {
    reply = await handleWaist(normalized.slice("/waist ".length), todayISO);
  } else if (cmd === "/waist") {
    reply = await handleWaist("", todayISO);
  } else if (cmd === "/body") {
    reply = await handleBody(parsePosInt(arg1, 30));
  } else if (cmd === "/streak") {
    reply = await handleStreak(todayISO);
  } else if (cmd === "/calendar") {
    reply = await handleCalendar();
  } else {
    reply = await handleHelp();
  }

  await sendTelegram(reply);
  return NextResponse.json({ ok: true });
}
