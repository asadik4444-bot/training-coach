import { NextRequest, NextResponse } from "next/server";
import { sendTelegramWithButtons } from "@/lib/telegram";
import { isSkipped } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    );
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const todayDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
    );
    const todayISO = todayDate.toISOString().slice(0, 10);

    // Skip if today was already marked as a skip
    if (await isSkipped(todayISO)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    await sendTelegramWithButtons("How was today's session?", [
      [
        { text: "Done ✓", callback_data: "session_done" },
        { text: "Skipped", callback_data: "session_skip" },
        { text: "Modified", callback_data: "session_modified" },
      ],
      [{ text: "Couldn't train", callback_data: "session_couldnt" }],
    ]);

    return NextResponse.json({ ok: true, sent: todayISO });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
