import { NextRequest, NextResponse } from "next/server";
import { sendTelegram } from "@/lib/telegram";
import { handleReport } from "@/lib/commands";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected)
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Europe/Zurich today date
  const todayISO = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Zurich",
  });

  const report = await handleReport("month", todayISO);
  await sendTelegram(report);

  return NextResponse.json({ ok: true });
}
