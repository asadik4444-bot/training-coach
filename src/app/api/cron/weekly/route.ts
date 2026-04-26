import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
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
import { parsePlan } from "@/lib/plan";
import { decideToday } from "@/lib/coach";
import { toMetrics, summarize, polarizedAnalysis } from "@/lib/analytics";

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

  // Read plan phase if available (v3 ritual populates this)
  let planPhase: string | undefined;
  try {
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));
    planPhase = plan.phase;
  } catch {
    // plan.yml read failure is non-critical
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

    if (planPhase) {
      lines.push(`Phase: ${planPhase}`);
    }

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

    // ── Analytics: HRV / RHR / sleep summaries + polarized ratio ────────────
    const metrics = toMetrics(snaps);
    const hrvSum = summarize(metrics, "hrv");
    const rhrSum = summarize(metrics, "rhr");
    const sleepEffSum = summarize(metrics, "sleep_eff");
    const pa = polarizedAnalysis(metrics);

    lines.push("");
    lines.push("📊 This week analytics");

    if (hrvSum.count > 0) {
      const cvNote =
        hrvSum.cv_pct != null
          ? ` CV ${hrvSum.cv_pct.toFixed(1)}%${hrvSum.cv_pct > 12 ? " ⚠️" : ""}`
          : "";
      lines.push(
        `HRV: avg ${hrvSum.avg?.toFixed(1) ?? "?"}ms${cvNote}  ${hrvSum.spark}`,
      );
    }

    if (rhrSum.count > 0) {
      lines.push(
        `RHR: avg ${rhrSum.avg?.toFixed(0) ?? "?"}bpm  ${rhrSum.spark}`,
      );
    }

    if (sleepEffSum.count > 0) {
      lines.push(
        `Sleep eff: avg ${sleepEffSum.avg?.toFixed(0) ?? "?"}%  ${sleepEffSum.spark}`,
      );
    }

    if (pa.compliance !== "unknown") {
      const ratioStr = pa.ratio != null ? pa.ratio.toFixed(2) : "∞";
      lines.push(
        `Zones ratio: ${ratioStr} — ${pa.compliance} (low ${pa.low_min}m / high ${pa.high_min}m)`,
      );
    }

    // ── Decision flags for today (deduped) ──────────────────────────────────
    // Use today's snapshot (index 0 = today in the listBiometricSnapshots result)
    const todaySnap = snaps.find((s) => {
      const todayStr = new Date().toISOString().slice(0, 10);
      return s.date === todayStr;
    });
    const todayDecision = decideToday(
      todaySnap?.recovery?.status ?? "no_record",
      todaySnap?.recovery?.score ?? null,
      todaySnap?.recovery?.hrv_rmssd_ms ?? null,
      trends,
    );
    if (todayDecision.flags.length > 0) {
      lines.push("");
      lines.push("⚠️ Active flags:");
      const seen = new Set<string>();
      for (const flag of todayDecision.flags) {
        if (!seen.has(flag)) {
          seen.add(flag);
          lines.push(`  • ${flag}`);
        }
      }
    }

    // ── Top recommendations ──────────────────────────────────────────────────
    const recs: string[] = [];

    // ACWR sustained high — use today's computed value as proxy
    if (trends.acwr !== null && trends.acwr > 1.3) {
      recs.push("Consider cutting volume 10-20% next week");
    }

    if (
      trends.sleep_debt_min_7day !== null &&
      trends.sleep_debt_min_7day > 300
    ) {
      recs.push("Prioritize sleep — bias bed time -30min for next week");
    }

    // HRV trended down >10% across the week
    if (
      trends.hrv_today_vs_baseline_pct !== null &&
      trends.hrv_today_vs_baseline_pct < -10
    ) {
      recs.push("Build in a deload");
    }

    // Polarized compliance
    if (pa.compliance === "threshold") {
      recs.push(
        "Add Z2 volume next week — ratio below 2, too much moderate grind",
      );
    } else if (pa.compliance === "pyramidal") {
      recs.push(
        "Push polarization — add Z2 or reduce Z3 work (target ratio ≥4)",
      );
    }

    if (recs.length > 0) {
      lines.push("");
      lines.push("💡 Top recommendations:");
      for (const rec of recs) {
        lines.push(`  • ${rec}`);
      }
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
