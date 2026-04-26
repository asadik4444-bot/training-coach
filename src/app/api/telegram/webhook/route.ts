import { NextRequest, NextResponse } from "next/server";
import { handleLog, handleSkip, handleSwap } from "@/lib/commands";
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const update: TelegramUpdate = await req.json();

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
  let reply: string;

  if (text.startsWith("/log ")) {
    reply = await handleLog(text.slice("/log ".length), todayISO);
  } else if (text === "/skip") {
    reply = await handleSkip(todayISO);
  } else if (text.startsWith("/swap ")) {
    reply = await handleSwap(text.slice("/swap ".length), todayISO);
  } else {
    reply = "Unknown command. Try /log, /skip, /swap";
  }

  await sendTelegram(reply);
  return NextResponse.json({ ok: true });
}
