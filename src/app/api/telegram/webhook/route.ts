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
  handleDone,
  handleGoal,
  handleGoals,
  handleProtein,
  handleBedtime,
  handlePain,
  handleExport,
} from "@/lib/commands";
import {
  sendTelegram,
  sendTelegramWithButtons,
  answerCallback,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    chat: { id: number };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { chat: { id: number } };
    data: string;
  };
}

function parsePosInt(raw: string | undefined, def: number): number {
  if (!raw) return def;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : def;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const update = (await req.json()) as TelegramUpdate;

  const todayDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
  );
  const todayISO = todayDate.toISOString().slice(0, 10);

  // ── Handle callback_query (inline button taps) ────────────────────────────
  if (update.callback_query) {
    const cb = update.callback_query;
    // Single-user guard using chat id from the callback message
    if (String(cb.message.chat.id) !== process.env.TELEGRAM_CHAT_ID) {
      return NextResponse.json({ ok: true });
    }

    const data = cb.data;

    if (data === "confirm") {
      await answerCallback(cb.id, "Confirmed.");
      await sendTelegram("Plan confirmed for today. ✓");
    } else if (data === "skip") {
      await handleSkip(todayISO);
      await answerCallback(cb.id, "Skipped.");
      await sendTelegram(
        "Today marked as skipped. Recovery-aware progression resumes tomorrow.",
      );
    } else if (data.startsWith("swap:")) {
      const target = data.slice(5);
      const result = await handleSwap(target, todayISO);
      await answerCallback(cb.id, "Swapped.");
      await sendTelegram(result);
    } else if (data === "done") {
      await handleDone("rpe 7", todayISO);
      await answerCallback(cb.id, "Logged.");
      // Send RPE picker
      await sendTelegramWithButtons("Session logged. Set RPE:", [
        [
          { text: "RPE 1-3", callback_data: "rpe:2" },
          { text: "RPE 4-5", callback_data: "rpe:5" },
          { text: "RPE 6-7", callback_data: "rpe:7" },
        ],
        [
          { text: "RPE 8-9", callback_data: "rpe:8" },
          { text: "RPE 10", callback_data: "rpe:10" },
        ],
      ]);
    } else if (data.startsWith("rpe:")) {
      const rpe = parseInt(data.slice(4), 10);
      if (Number.isFinite(rpe)) {
        await handleDone(`rpe ${rpe}`, todayISO);
        await answerCallback(cb.id, `Logged RPE ${rpe}.`);
        await sendTelegram(`RPE ${rpe} logged. ✓`);
      } else {
        await answerCallback(cb.id, "Invalid RPE.");
      }
    } else if (data === "session_done") {
      await handleDone("rpe 7", todayISO);
      await answerCallback(cb.id, "Done logged.");
      await sendTelegram(
        "Session logged as done. Use /done rpe N to update RPE.",
      );
    } else if (data === "session_skip") {
      await handleSkip(todayISO);
      await answerCallback(cb.id, "Skipped.");
      await sendTelegram("Session skipped. Rest up.");
    } else if (data === "session_modified") {
      await answerCallback(cb.id, "Modified — log details.");
      await sendTelegram("Use /done rpe N to log what you did.");
    } else if (data === "session_couldnt") {
      await handleSkip(todayISO);
      await answerCallback(cb.id, "Logged.");
      await sendTelegram(
        "Session missed. No sweat — keep the streak alive tomorrow.",
      );
    } else {
      await answerCallback(cb.id, "Unknown action.");
    }

    return NextResponse.json({ ok: true });
  }

  const message = update.message;

  // Ignore updates without a message or text — always 200 so Telegram doesn't retry
  if (!message || !message.text) {
    return NextResponse.json({ ok: true });
  }

  // Single-user guard: ignore messages from anyone else silently
  if (String(message.chat.id) !== process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true });
  }

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
  } else if (cmd === "/done") {
    reply = await handleDone(
      parts.length > 1 ? normalized.slice("/done ".length) : "",
      todayISO,
    );
  } else if (cmd === "/goal" && arg1) {
    const rest = parts.slice(2).join(" ");
    reply = await handleGoal(arg1, rest, todayISO);
  } else if (cmd === "/goal") {
    reply = await handleGoal("", "", todayISO);
  } else if (cmd === "/goals") {
    reply = await handleGoals(todayISO);
  } else if (cmd === "/protein") {
    reply = await handleProtein(arg1 ?? "", todayISO);
  } else if (cmd === "/bedtime") {
    reply = await handleBedtime(arg1 ?? "", todayISO);
  } else if (cmd === "/pain") {
    reply = await handlePain(
      parts.length > 1 ? normalized.slice("/pain ".length) : "",
      todayISO,
    );
  } else if (cmd === "/export") {
    reply = await handleExport();
  } else {
    reply = await handleHelp();
  }

  await sendTelegram(reply);
  return NextResponse.json({ ok: true });
}
