import { readFileSync } from "node:fs";
import path from "node:path";
import {
  appendDailyLog,
  setSkipped,
  setSwap,
  getBiometricSnapshot,
  listBiometricSnapshots,
} from "@/lib/kv";
import { toMetrics, summarize, polarizedAnalysis } from "@/lib/analytics";
import { computeTrends } from "@/lib/trends";
import { parsePlan, pickToday } from "@/lib/plan";
import type { BiometricSnapshot } from "@/lib/whoop";

const VALID_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

export async function handleLog(
  text: string,
  todayISO: string,
): Promise<string> {
  const entry = text.trim();
  if (!entry) return "Usage: /log <entry>";
  await appendDailyLog(todayISO, entry);
  return `Logged: ${entry}`;
}

export async function handleSkip(todayISO: string): Promise<string> {
  await setSkipped(todayISO);
  return "Marked today as skipped. Recovery-aware progression resumes Monday.";
}

export async function handleSwap(
  target: string,
  todayISO: string,
): Promise<string> {
  const day = target.trim().toLowerCase();
  if (!VALID_DAYS.has(day)) {
    return "Swap target must be monday–friday";
  }
  await setSwap(todayISO, day);
  return `Swapped: today's session is now ${day}'s plan`;
}

// ── /help ─────────────────────────────────────────────────────────────────────

export async function handleHelp(): Promise<string> {
  return [
    "Commands:",
    "/today — today's snapshot: recovery, HRV, sleep, workout",
    "/hrv [N] — HRV trend over N days (default 7)",
    "/rhr [N] — RHR trend over N days",
    "/sleep [N] — sleep efficiency + duration trend",
    "/zones [N] — HR zone breakdown + polarized ratio",
    "/load — training load ACWR (7d/28d)",
    "/report [week|month|year] — full analytics summary",
    "/recent [N] — last N workouts (default 5)",
    "/backfill — pull 90 days of history from Whoop",
    "/setup — backfill + onboarding guide",
    "/log <text> — append training note",
    "/skip — mark today skipped",
    "/swap <day> — swap today's plan with another day",
  ].join("\n");
}

// ── /today ────────────────────────────────────────────────────────────────────

export async function handleToday(todayISO: string): Promise<string> {
  const snap = (await getBiometricSnapshot(
    todayISO,
  )) as BiometricSnapshot | null;
  if (!snap) return "No data yet for today.";

  const lines: string[] = [`📅 ${todayISO}`];

  // Recovery / HRV / RHR
  const rec = snap.recovery;
  const recStr = rec.status === "scored" ? `${rec.score ?? "?"}%` : rec.status;
  const hrvStr =
    rec.hrv_rmssd_ms != null
      ? ` / HRV: ${Math.round(rec.hrv_rmssd_ms)} ms`
      : "";
  const rhrStr = rec.rhr_bpm != null ? ` / RHR: ${rec.rhr_bpm} bpm` : "";
  lines.push(`Recovery: ${recStr}${hrvStr}${rhrStr}`);

  // Sleep
  if (snap.sleep) {
    const s = snap.sleep;
    const totalH = Math.floor(s.total_in_bed_min / 60);
    const totalM = s.total_in_bed_min % 60;
    lines.push(
      `Sleep: efficiency ${Math.round(s.efficiency_pct)}%, total ${totalH}h ${totalM}m`,
    );
  }

  // Last workout
  if (snap.last_workout) {
    const w = snap.last_workout;
    const z = w.zone_minutes;
    const distStr =
      w.distance_meters != null
        ? `  ${(w.distance_meters / 1000).toFixed(1)}km`
        : "";
    lines.push(`Workout: ${w.sport} — strain ${w.strain.toFixed(1)}`);
    lines.push(
      `  Z1:${z.z1}m Z2:${z.z2}m Z3:${z.z3}m Z4:${z.z4}m Z5:${z.z5}m${distStr}`,
    );
  }

  // Today's plan
  try {
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));
    const weekday = new Date(todayISO + "T12:00:00Z").getUTCDay();
    const day = pickToday(plan, weekday);
    if (day) {
      lines.push(`Plan: [${day.type}] ${day.summary}`);
    }
  } catch {
    // plan read is non-critical
  }

  return lines.join("\n");
}

// ── /hrv ──────────────────────────────────────────────────────────────────────

export async function handleHrv(
  daysBack: number,
  todayISO: string,
): Promise<string> {
  const raw = (await listBiometricSnapshots(daysBack)) as BiometricSnapshot[];
  const metrics = toMetrics(raw);
  const s = summarize(metrics, "hrv");

  if (s.count === 0)
    return `No HRV data in last ${daysBack} days. Run /backfill first.`;

  const deltaStr =
    s.delta_from_avg !== null && s.avg !== null
      ? ` (${s.delta_from_avg >= 0 ? "+" : ""}${s.delta_from_avg.toFixed(1)} vs avg ${s.avg.toFixed(1)})`
      : "";
  const cvNote =
    s.cv_pct != null
      ? s.cv_pct < 10
        ? " (healthy <10%)"
        : s.cv_pct < 12
          ? ""
          : " (watch >12%)"
      : "";

  return [
    `🫀 HRV — last ${daysBack} days`,
    `Latest: ${s.latest?.toFixed(1) ?? "?"} ms${deltaStr}`,
    `Range: ${s.min?.toFixed(0) ?? "?"}–${s.max?.toFixed(0) ?? "?"} ms`,
    s.cv_pct != null ? `CV: ${s.cv_pct.toFixed(1)}%${cvNote}` : null,
    `Trend: ${s.spark}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── /rhr ──────────────────────────────────────────────────────────────────────

export async function handleRhr(
  daysBack: number,
  todayISO: string,
): Promise<string> {
  const raw = (await listBiometricSnapshots(daysBack)) as BiometricSnapshot[];
  const metrics = toMetrics(raw);
  const s = summarize(metrics, "rhr");

  if (s.count === 0)
    return `No RHR data in last ${daysBack} days. Run /backfill first.`;

  const deltaStr =
    s.delta_from_avg !== null && s.avg !== null
      ? ` (${s.delta_from_avg >= 0 ? "+" : ""}${s.delta_from_avg.toFixed(1)} vs avg ${s.avg.toFixed(1)})`
      : "";

  return [
    `❤️ RHR — last ${daysBack} days`,
    `Latest: ${s.latest?.toFixed(0) ?? "?"} bpm${deltaStr}`,
    `Range: ${s.min?.toFixed(0) ?? "?"}–${s.max?.toFixed(0) ?? "?"} bpm`,
    s.cv_pct != null ? `CV: ${s.cv_pct.toFixed(1)}%` : null,
    `Trend: ${s.spark}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── /sleep ────────────────────────────────────────────────────────────────────

export async function handleSleep(
  daysBack: number,
  todayISO: string,
): Promise<string> {
  const raw = (await listBiometricSnapshots(daysBack)) as BiometricSnapshot[];
  const metrics = toMetrics(raw);
  const eff = summarize(metrics, "sleep_eff");
  const dur = summarize(metrics, "sleep_min");

  if (eff.count === 0)
    return `No sleep data in last ${daysBack} days. Run /backfill first.`;

  const effDelta =
    eff.delta_from_avg !== null
      ? ` (${eff.delta_from_avg >= 0 ? "+" : ""}${eff.delta_from_avg.toFixed(1)}% vs avg)`
      : "";
  const durLatestH = dur.latest != null ? Math.floor(dur.latest / 60) : null;
  const durLatestM = dur.latest != null ? dur.latest % 60 : null;
  const durAvgH = dur.avg != null ? (dur.avg / 60).toFixed(1) : null;

  return [
    `😴 Sleep — last ${daysBack} days`,
    `Efficiency: ${eff.latest?.toFixed(0) ?? "?"}%${effDelta}`,
    `Range: ${eff.min?.toFixed(0) ?? "?"}–${eff.max?.toFixed(0) ?? "?"}%`,
    dur.latest != null
      ? `Duration: ${durLatestH}h ${durLatestM}m (avg ${durAvgH}h)`
      : null,
    `Trend: ${eff.spark}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ── /zones ────────────────────────────────────────────────────────────────────

export async function handleZones(
  daysBack: number,
  todayISO: string,
): Promise<string> {
  const raw = (await listBiometricSnapshots(daysBack)) as BiometricSnapshot[];
  const metrics = toMetrics(raw);
  const pa = polarizedAnalysis(metrics);

  if (pa.compliance === "unknown") {
    return `No zone data in last ${daysBack} days. Run /backfill first or log a workout.`;
  }

  // Aggregate totals for display
  let z0 = 0,
    z1 = 0,
    z2 = 0,
    z3 = 0,
    z4 = 0,
    z5 = 0;
  for (const m of metrics) {
    if (!m.zone_minutes) continue;
    z0 += m.zone_minutes.z0;
    z1 += m.zone_minutes.z1;
    z2 += m.zone_minutes.z2;
    z3 += m.zone_minutes.z3;
    z4 += m.zone_minutes.z4;
    z5 += m.zone_minutes.z5;
  }

  const ratioStr = pa.ratio != null ? pa.ratio.toFixed(2) : "∞";
  const complianceNote = {
    polarized: "polarized ✓ (≥4, ideal 80/20)",
    pyramidal: "pyramidal (target: ≥4 for polarized)",
    threshold: "threshold — too much moderate intensity",
    unknown: "",
  }[pa.compliance];

  return [
    `⏱️ HR zones — last ${daysBack} days`,
    `Z0:${z0}m  Z1:${z1}m  Z2:${z2}m  Z3:${z3}m  Z4:${z4}m  Z5:${z5}m`,
    `Low (Z1-Z2): ${pa.low_min}m | High (Z3-Z5): ${pa.high_min}m`,
    `Ratio: ${ratioStr} — ${complianceNote}`,
  ].join("\n");
}

// ── /load ─────────────────────────────────────────────────────────────────────

export async function handleLoad(todayISO: string): Promise<string> {
  const raw = (await listBiometricSnapshots(28)) as BiometricSnapshot[];
  const trends = computeTrends(raw);

  if (trends.acwr === null && trends.strain_7day_avg === null) {
    return "No strain data available. Run /backfill first.";
  }

  let acwrNote = "";
  if (trends.acwr !== null) {
    if (trends.acwr < 0.8) acwrNote = " — detraining";
    else if (trends.acwr <= 1.3) acwrNote = " — sweet spot (0.8–1.3)";
    else if (trends.acwr <= 1.5) acwrNote = " — high, consider deload soon";
    else acwrNote = " — overreaching risk";
  }

  return [
    "📊 Training load (ACWR)",
    `Acute (7d):   ${trends.strain_7day_avg?.toFixed(1) ?? "?"}`,
    `Chronic (28d): ${trends.strain_28day_avg?.toFixed(1) ?? "?"}`,
    trends.acwr != null
      ? `ACWR: ${trends.acwr.toFixed(2)}${acwrNote}`
      : "ACWR: insufficient data",
  ].join("\n");
}

// ── /report ───────────────────────────────────────────────────────────────────

export async function handleReport(
  window: "week" | "month" | "year",
  todayISO: string,
): Promise<string> {
  const daysMap = { week: 7, month: 30, year: 365 };
  const daysBack = daysMap[window];

  const raw = (await listBiometricSnapshots(daysBack)) as BiometricSnapshot[];
  const metrics = toMetrics(raw);

  if (metrics.length === 0) {
    return `No data for last ${daysBack} days. Run /backfill first.`;
  }

  const recSum = summarize(metrics, "recovery");
  const hrvSum = summarize(metrics, "hrv");
  const rhrSum = summarize(metrics, "rhr");
  const sleepSum = summarize(metrics, "sleep_eff");
  const strainSum = summarize(metrics, "strain");
  const pa = polarizedAnalysis(metrics);

  const lines: string[] = [
    `📊 ${window.charAt(0).toUpperCase() + window.slice(1)} report (${daysBack} days)`,
    "",
  ];

  if (recSum.count > 0) {
    lines.push(
      `Recovery:  avg ${recSum.avg?.toFixed(0) ?? "?"}%  ${recSum.spark}`,
    );
  }
  if (hrvSum.count > 0) {
    lines.push(
      `HRV:       avg ${hrvSum.avg?.toFixed(1) ?? "?"} ms  ${hrvSum.spark}`,
    );
  }
  if (rhrSum.count > 0) {
    lines.push(
      `RHR:       avg ${rhrSum.avg?.toFixed(0) ?? "?"} bpm  ${rhrSum.spark}`,
    );
  }
  if (sleepSum.count > 0) {
    lines.push(
      `Sleep eff: avg ${sleepSum.avg?.toFixed(0) ?? "?"}%  ${sleepSum.spark}`,
    );
  }
  if (strainSum.count > 0) {
    const totalStrain = metrics
      .map((m) => m.strain ?? 0)
      .reduce((a, b) => a + b, 0);
    lines.push(
      `Strain:    total ${totalStrain.toFixed(1)}, avg/day ${strainSum.avg?.toFixed(1) ?? "?"}`,
    );
  }

  // ACWR for week/month only
  if (window !== "year") {
    const trends = computeTrends(raw);
    if (trends.acwr !== null) {
      let acwrNote = "";
      if (trends.acwr < 0.8) acwrNote = " — detraining";
      else if (trends.acwr <= 1.3) acwrNote = " — sweet spot";
      else if (trends.acwr <= 1.5) acwrNote = " — high";
      else acwrNote = " — overreaching";
      lines.push(`ACWR: ${trends.acwr.toFixed(2)}${acwrNote}`);
    }
  }

  // Polarized analysis
  if (pa.compliance !== "unknown") {
    const ratioStr = pa.ratio != null ? pa.ratio.toFixed(2) : "∞";
    lines.push(`Zones: ratio ${ratioStr} — ${pa.compliance}`);
  }

  // Year: monthly breakdown (12 rows max)
  if (window === "year") {
    lines.push("");
    lines.push("Monthly breakdown:");
    const byMonth: Record<string, { recoveries: number[]; hrvs: number[] }> =
      {};
    for (const m of metrics) {
      const mo = m.date.slice(0, 7); // YYYY-MM
      if (!byMonth[mo]) byMonth[mo] = { recoveries: [], hrvs: [] };
      if (m.recovery != null) byMonth[mo].recoveries.push(m.recovery);
      if (m.hrv != null) byMonth[mo].hrvs.push(m.hrv);
    }
    const months = Object.keys(byMonth).sort().slice(-12);
    for (const mo of months) {
      const d = byMonth[mo];
      const avgRec = d.recoveries.length
        ? Math.round(
            d.recoveries.reduce((a, b) => a + b, 0) / d.recoveries.length,
          )
        : null;
      const avgHrv = d.hrvs.length
        ? (d.hrvs.reduce((a, b) => a + b, 0) / d.hrvs.length).toFixed(1)
        : null;
      const recStr = avgRec != null ? `rec ${avgRec}%` : "rec ?";
      const hrvStr = avgHrv != null ? `HRV ${avgHrv}ms` : "";
      lines.push(`  ${mo}  ${recStr}  ${hrvStr}`);
    }
  }

  // Recommendations
  const recs: string[] = [];
  if (pa.compliance === "threshold") {
    recs.push("Add Z2 volume next week — too much moderate intensity");
  }
  if (pa.compliance === "pyramidal") {
    recs.push("Push ratio toward ≥4 — add Z2 or cut Z3 work");
  }
  if (sleepSum.avg != null && sleepSum.avg < 80) {
    recs.push("Sleep efficiency below 80% — review bedtime habits");
  }
  if (hrvSum.cv_pct != null && hrvSum.cv_pct > 12) {
    recs.push(
      `HRV CV ${hrvSum.cv_pct.toFixed(1)}% — high variability, manage load`,
    );
  }
  if (recs.length > 0) {
    lines.push("");
    lines.push("Recommendations:");
    for (const r of recs) lines.push(`  • ${r}`);
  }

  return lines.join("\n");
}

// ── /recent ───────────────────────────────────────────────────────────────────

export async function handleRecent(
  n: number,
  todayISO: string,
): Promise<string> {
  const raw = (await listBiometricSnapshots(90)) as BiometricSnapshot[];
  const withWorkout = raw.filter((s) => s.last_workout != null);

  if (withWorkout.length === 0) {
    return "No workouts found. Run /backfill first.";
  }

  // Sort descending by date, take n
  const recent = withWorkout
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, n);

  const lines: string[] = [`🏋️ Last ${recent.length} workouts`];
  for (const snap of recent) {
    const w = snap.last_workout!;
    const z = w.zone_minutes;
    const distStr =
      w.distance_meters != null
        ? `  ${(w.distance_meters / 1000).toFixed(1)}km`
        : "";
    lines.push(`${snap.date} ${w.sport} — strain ${w.strain.toFixed(1)}`);
    lines.push(`  Z2:${z.z2}m  Z3:${z.z3}m  Z4:${z.z4}m${distStr}`);
  }

  return lines.join("\n");
}

// ── /backfill ─────────────────────────────────────────────────────────────────

export async function handleBackfill(): Promise<string> {
  const secret = process.env.CRON_SECRET;
  const url = `https://training-coach-phi.vercel.app/api/backfill?days=90`;
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${secret}` },
  });
  const data = (await res.json()) as {
    ok: boolean;
    stored?: number;
    range?: { startISO: string; endISO: string };
    error?: string;
  };
  if (!data.ok) return `Backfill failed: ${data.error}`;
  return `Backfilled ${data.stored} days from ${data.range!.startISO} to ${data.range!.endISO}.`;
}

// ── /setup ────────────────────────────────────────────────────────────────────

export async function handleSetup(): Promise<string> {
  const backfillResult = await handleBackfill();
  return [
    backfillResult,
    "",
    "You're set up! Try:",
    "  /today — today's snapshot",
    "  /hrv 30 — 30-day HRV trend",
    "  /report month — full monthly summary",
    "  /load — training load ACWR",
  ].join("\n");
}
