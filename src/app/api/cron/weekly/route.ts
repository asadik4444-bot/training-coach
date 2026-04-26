import { NextRequest, NextResponse } from "next/server";
import { getDailyLog, isSkipped, getSwap, getRecoverySnapshot } from "@/lib/kv";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function isoDateNDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

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

  const lines: string[] = ["📊 Weekly summary", ""];
  const recoveries: number[] = [];
  let skipped = 0,
    swaps = 0,
    logEntries = 0;

  for (let i = 0; i < 7; i++) {
    const date = isoDateNDaysAgo(i);
    const r = await getRecoverySnapshot(date);
    if (r != null) recoveries.push(r);
    if (await isSkipped(date)) skipped++;
    if (await getSwap(date)) swaps++;
    const log = await getDailyLog(date);
    logEntries += log.length;
  }

  if (recoveries.length) {
    const avg = Math.round(
      recoveries.reduce((a, b) => a + b, 0) / recoveries.length,
    );
    lines.push(`Avg recovery: ${avg}% (${recoveries.length} days)`);
  } else {
    lines.push("No recovery data this week.");
  }
  lines.push(`Skipped: ${skipped}`);
  lines.push(`Swapped: ${swaps}`);
  lines.push(`Logged entries: ${logEntries}`);
  lines.push("");
  lines.push("Sunday ritual: open ~/training-coach in Claude Code and ask:");
  lines.push(
    '"Read this week summary + plan.yml history. Generate next week plan.yml respecting 3 lift days, 2 runs, body-part rotation, progressive overload."',
  );

  await sendTelegram(lines.join("\n"));
  return NextResponse.json({ ok: true });
}
