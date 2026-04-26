import { NextRequest, NextResponse } from "next/server";
import {
  getDailyLog,
  isSkipped,
  getSwap,
  getRecoverySnapshot,
  listBiometricSnapshots,
} from "@/lib/kv";
import { sendTelegram } from "@/lib/telegram";
import { computeTrends } from "@/lib/trends";
import type { BiometricSnapshot } from "@/lib/whoop";

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

  // ── Biometric trends (28-day window) ──────────────────────────────────────
  try {
    const rawSnaps = await listBiometricSnapshots(28);
    const snaps = rawSnaps as BiometricSnapshot[];
    const trends = computeTrends(snaps);

    lines.push("");
    lines.push("📈 Biometric trends (28-day window)");

    if (trends.hrv_baseline_7day !== null) {
      const baseline = Math.round(trends.hrv_baseline_7day);
      const delta =
        trends.hrv_today_vs_baseline_pct !== null
          ? ` (today ${trends.hrv_today_vs_baseline_pct >= 0 ? "+" : ""}${Math.round(trends.hrv_today_vs_baseline_pct)}%)`
          : "";
      lines.push(`HRV 7-day baseline: ${baseline} ms${delta}`);
    }

    if (trends.rhr_baseline_7day !== null) {
      const baseline = Math.round(trends.rhr_baseline_7day);
      const delta =
        trends.rhr_today_vs_baseline_bpm !== null
          ? ` (today ${trends.rhr_today_vs_baseline_bpm >= 0 ? "+" : ""}${Math.round(trends.rhr_today_vs_baseline_bpm)} bpm)`
          : "";
      lines.push(`RHR 7-day baseline: ${baseline} bpm${delta}`);
    }

    if (trends.sleep_efficiency_avg_7day !== null) {
      lines.push(
        `Avg sleep efficiency (7d): ${Math.round(trends.sleep_efficiency_avg_7day)}%`,
      );
    }

    if (trends.sleep_debt_min_7day !== null) {
      const debtH = (trends.sleep_debt_min_7day / 60).toFixed(1);
      lines.push(`Sleep debt (7d vs 8h target): ${debtH}h`);
    }

    if (trends.acwr !== null) {
      const acwr = trends.acwr.toFixed(2);
      let interpretation: string;
      if (trends.acwr < 0.8) {
        interpretation = "detraining";
      } else if (trends.acwr <= 1.3) {
        interpretation = "sweet spot";
      } else if (trends.acwr <= 1.5) {
        interpretation = "high — consider deload soon";
      } else {
        interpretation = "overreaching risk — deload this week";
      }
      lines.push(`ACWR: ${acwr} (${interpretation})`);
    }
  } catch {
    // trends section is non-critical; omit silently
  }

  lines.push("");
  lines.push("Sunday ritual: open ~/training-coach in Claude Code and ask:");
  lines.push(
    '"Read this week summary + plan.yml history. Generate next week plan.yml respecting 3 lift days, 2 runs, body-part rotation, progressive overload."',
  );

  await sendTelegram(lines.join("\n"));
  return NextResponse.json({ ok: true });
}
