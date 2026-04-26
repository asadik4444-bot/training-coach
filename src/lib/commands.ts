import { readFileSync } from "node:fs";
import path from "node:path";
import {
  appendDailyLog,
  setSkipped,
  setSwap,
  getBiometricSnapshot,
  listBiometricSnapshots,
  setBodyMeasurement,
  listBodyMeasurements,
  isSkipped,
  saveDoneEntry,
  setGoal,
  listAllGoals,
  setProtein,
  getProtein,
  listProtein,
  setBedtime,
  listBedtimes,
  addPainEntry,
  getPainEntries,
  listPainEntries,
  appendToArchive,
  getArchiveMonth,
  listArchiveMonths,
  type GoalField,
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
    "/today — snapshot: recovery, HRV, sleep, workout",
    "/hrv [N] — HRV trend (default 7 days)",
    "/rhr [N] — RHR trend",
    "/sleep [N] — sleep efficiency + duration trend",
    "/zones [N] — HR zone breakdown + polarized ratio",
    "/load — training load ACWR (7d/28d)",
    "/report [week|month|year] — analytics summary",
    "/recent [N] — last N workouts (default 5)",
    "/weight <kg> — log body weight",
    "/waist <cm> — log waist measurement",
    "/body [N] — body comp trend (default 30 days)",
    "/done rpe 8 rir 2 soreness 5 [notes] — log session effort",
    "/goal <field> <value> — set a goal (weight/waist/hrv/rhr)",
    "/goals — show all goals + current progress",
    "/calendar — 90-day recovery heatmap",
    "/protein [y|n] — log protein hit/miss or show 7-day rate",
    "/bedtime [HH:MM] — log bedtime or show 7-day avg",
    "/pain [area severity note] — log pain or show 7-day log",
    "/export — get archive export URL",
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
  const weekday = new Date(todayISO + "T12:00:00Z").getUTCDay(); // 0=Sun…6=Sat
  try {
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));
    const day = pickToday(plan, weekday);
    if (day) {
      lines.push(`Plan: [${day.type}] ${day.summary}`);
    }
  } catch {
    // plan read is non-critical
  }

  // Adaptive weekday context
  if (weekday === 1) {
    // Monday: preview this week's plan
    lines.push("📋 New week. Execute with intent.");
  } else if (weekday === 3) {
    // Wednesday: midweek check
    const snaps7 = (await listBiometricSnapshots(7)) as BiometricSnapshot[];
    const sessionsThisWeek = snaps7.filter(
      (s) => s.last_workout != null,
    ).length;
    lines.push(`📊 Midweek: ${sessionsThisWeek} sessions logged this week.`);
    const trds = computeTrends(snaps7);
    if (trds.acwr !== null) lines.push(`  ACWR: ${trds.acwr.toFixed(2)}`);
  } else if (weekday === 5) {
    // Friday: brief week summary
    const snaps7 = (await listBiometricSnapshots(7)) as BiometricSnapshot[];
    const sessions = snaps7.filter((s) => s.last_workout != null).length;
    const avgRec =
      snaps7.length > 0
        ? Math.round(
            snaps7
              .filter(
                (s) =>
                  s.recovery.status === "scored" && s.recovery.score != null,
              )
              .reduce((a, s) => a + (s.recovery.score ?? 0), 0) /
              Math.max(
                1,
                snaps7.filter((s) => s.recovery.status === "scored").length,
              ),
          )
        : null;
    lines.push(
      `📅 Week so far: ${sessions} sessions${avgRec != null ? `, avg recovery ${avgRec}%` : ""}.`,
    );
  } else if (weekday === 0 || weekday === 6) {
    // Weekend: rest reminder + Monday sneak peek
    lines.push("🛋️ Rest day. Recharge. Monday kicks off a new block.");
  }

  // Protein hit rate (last 7 days)
  const proteinHistory = await listProtein(7);
  if (proteinHistory.length > 0) {
    const hits = proteinHistory.filter((e) => e.hit).length;
    const rate = Math.round((hits / proteinHistory.length) * 100);
    lines.push(`Protein: ${hits}/${proteinHistory.length} days (${rate}%)`);
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

/** Format a delta as "+N" / "-N" with optional unit. */
function fmtDelta(curr: number | null, prev: number | null): string {
  if (curr == null || prev == null) return "";
  const d = curr - prev;
  return (d >= 0 ? "+" : "") + d.toFixed(1);
}

export async function handleReport(
  window: "week" | "month" | "year",
  todayISO: string,
): Promise<string> {
  const daysMap = { week: 7, month: 30, year: 365 };
  const daysBack = daysMap[window];

  // For week/month: fetch 2x days so we can compute prior period too
  const fetchDays = window === "year" ? daysBack : daysBack * 2;
  const allRaw = (await listBiometricSnapshots(
    fetchDays,
  )) as BiometricSnapshot[];

  // Compute cutoff: current period = last daysBack days
  const today = new Date(todayISO + "T00:00:00Z");
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() - daysBack);
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const currentRaw = allRaw.filter((s) => s.date > cutoffISO);
  const priorRaw = allRaw.filter((s) => s.date <= cutoffISO);

  const raw = window === "year" ? allRaw : currentRaw;
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

  // Prior period summaries (only for week/month)
  const hasPrior = window !== "year" && priorRaw.length > 0;
  const priorMetrics = hasPrior ? toMetrics(priorRaw) : [];
  const pRec = hasPrior ? summarize(priorMetrics, "recovery") : null;
  const pHrv = hasPrior ? summarize(priorMetrics, "hrv") : null;
  const pRhr = hasPrior ? summarize(priorMetrics, "rhr") : null;
  const pSleep = hasPrior ? summarize(priorMetrics, "sleep_eff") : null;
  const pStrain = hasPrior ? summarize(priorMetrics, "strain") : null;

  const lines: string[] = [
    `📊 ${window.charAt(0).toUpperCase() + window.slice(1)} report (${daysBack} days)`,
  ];

  if (hasPrior) {
    lines.push("         Current  Previous    Δ");
  }
  lines.push("");

  if (recSum.count > 0) {
    const curr = recSum.avg?.toFixed(0) ?? "?";
    if (hasPrior && pRec && pRec.count > 0) {
      const prev = pRec.avg?.toFixed(0) ?? "?";
      const d = fmtDelta(recSum.avg, pRec.avg);
      lines.push(`Recovery:  ${curr.padStart(6)}%  ${prev.padStart(7)}%  ${d}`);
    } else {
      lines.push(`Recovery:  avg ${curr}%  ${recSum.spark}`);
    }
  }
  if (hrvSum.count > 0) {
    const curr = hrvSum.avg?.toFixed(1) ?? "?";
    if (hasPrior && pHrv && pHrv.count > 0) {
      const prev = pHrv.avg?.toFixed(1) ?? "?";
      const d = fmtDelta(hrvSum.avg, pHrv.avg);
      lines.push(`HRV:       ${curr.padStart(6)}ms ${prev.padStart(7)}ms ${d}`);
    } else {
      lines.push(`HRV:       avg ${curr} ms  ${hrvSum.spark}`);
    }
  }
  if (rhrSum.count > 0) {
    const curr = rhrSum.avg?.toFixed(0) ?? "?";
    if (hasPrior && pRhr && pRhr.count > 0) {
      const prev = pRhr.avg?.toFixed(0) ?? "?";
      const d = fmtDelta(rhrSum.avg, pRhr.avg);
      lines.push(
        `RHR:       ${curr.padStart(5)}bpm  ${prev.padStart(6)}bpm  ${d}`,
      );
    } else {
      lines.push(`RHR:       avg ${curr} bpm  ${rhrSum.spark}`);
    }
  }
  if (sleepSum.count > 0) {
    const curr = sleepSum.avg?.toFixed(0) ?? "?";
    if (hasPrior && pSleep && pSleep.count > 0) {
      const prev = pSleep.avg?.toFixed(0) ?? "?";
      const d = fmtDelta(sleepSum.avg, pSleep.avg);
      lines.push(`Sleep eff: ${curr.padStart(6)}%  ${prev.padStart(7)}%  ${d}`);
    } else {
      lines.push(`Sleep eff: avg ${curr}%  ${sleepSum.spark}`);
    }
  }
  if (strainSum.count > 0) {
    const totalStrain = metrics
      .map((m) => m.strain ?? 0)
      .reduce((a, b) => a + b, 0);
    if (hasPrior && pStrain && pStrain.count > 0) {
      const prevTotal = priorMetrics
        .map((m) => m.strain ?? 0)
        .reduce((a, b) => a + b, 0);
      const d = fmtDelta(totalStrain, prevTotal);
      lines.push(
        `Strain:    total ${totalStrain.toFixed(1)} / prev ${prevTotal.toFixed(1)} (${d})`,
      );
    } else {
      lines.push(
        `Strain:    total ${totalStrain.toFixed(1)}, avg/day ${strainSum.avg?.toFixed(1) ?? "?"}`,
      );
    }
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

// ── /weight ───────────────────────────────────────────────────────────────────

export async function handleWeight(
  text: string,
  todayISO: string,
): Promise<string> {
  const num = parseFloat(text.trim());
  if (isNaN(num) || num < 30 || num > 250) {
    return "Usage: /weight 79.4  (kg, between 30 and 250)";
  }
  await setBodyMeasurement(todayISO, "weight", num);
  return `Logged weight ${num}kg for ${todayISO}.`;
}

// ── /waist ────────────────────────────────────────────────────────────────────

export async function handleWaist(
  text: string,
  todayISO: string,
): Promise<string> {
  const num = parseFloat(text.trim());
  if (isNaN(num) || num < 30 || num > 200) {
    return "Usage: /waist 84  (cm, between 30 and 200)";
  }
  await setBodyMeasurement(todayISO, "waist", num);
  return `Logged waist ${num}cm for ${todayISO}.`;
}

// ── /body ─────────────────────────────────────────────────────────────────────

export async function handleBody(daysBack: number): Promise<string> {
  const weights = await listBodyMeasurements("weight", daysBack);
  const waists = await listBodyMeasurements("waist", daysBack);
  if (weights.length === 0 && waists.length === 0) {
    return `No body measurements logged. Try /weight 79.4 or /waist 84.`;
  }
  const lines: string[] = [`📐 Body — last ${daysBack} days`];
  if (weights.length) {
    const vals = weights.map((w) => w.value);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const delta = (last - first).toFixed(1);
    const sign = last >= first ? "+" : "";
    lines.push(
      `Weight: ${last}kg (${sign}${delta} over ${weights.length} entries)`,
    );
  }
  if (waists.length) {
    const vals = waists.map((w) => w.value);
    const first = vals[0];
    const last = vals[vals.length - 1];
    const delta = (last - first).toFixed(1);
    const sign = last >= first ? "+" : "";
    lines.push(
      `Waist: ${last}cm (${sign}${delta} over ${waists.length} entries)`,
    );
  }
  return lines.join("\n");
}

// ── /streak ───────────────────────────────────────────────────────────────────

export async function handleStreak(todayISO: string): Promise<string> {
  const { computeStreaks } = await import("@/lib/streak");
  const snaps = (await listBiometricSnapshots(
    60,
  )) as import("@/lib/whoop").BiometricSnapshot[];
  const skipMap: Record<string, boolean> = {};
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    skipMap[date] = await isSkipped(date);
  }
  const s = computeStreaks(snaps, skipMap);
  return [
    "🔥 Streaks",
    `Green recovery: ${s.green_recovery} days (best ${s.best_green_recovery})`,
    `No-skip workdays: ${s.no_skip}`,
  ].join("\n");
}

// ── /done ─────────────────────────────────────────────────────────────────────

export function parseDoneText(text: string): {
  rpe?: number;
  rir?: number;
  soreness?: number;
  notes?: string;
} {
  const out: { rpe?: number; rir?: number; soreness?: number; notes?: string } =
    {};
  const rpeMatch = text.match(/\brpe\s+(\d+(?:\.\d+)?)/i);
  if (rpeMatch) out.rpe = Number(rpeMatch[1]);
  const rirMatch = text.match(/\brir\s+(\d+(?:\.\d+)?)/i);
  if (rirMatch) out.rir = Number(rirMatch[1]);
  const soreMatch = text.match(/\bsoreness\s+(\d+(?:\.\d+)?)/i);
  if (soreMatch) out.soreness = Number(soreMatch[1]);
  const cleaned = text
    .replace(/\brpe\s+\d+(\.\d+)?/gi, "")
    .replace(/\brir\s+\d+(\.\d+)?/gi, "")
    .replace(/\bsoreness\s+\d+(\.\d+)?/gi, "")
    .trim();
  if (cleaned.length > 0) out.notes = cleaned;
  return out;
}

export async function handleDone(
  text: string,
  todayISO: string,
): Promise<string> {
  if (!text.trim()) return "Usage: /done rpe 8 rir 2 soreness 5 felt strong";
  const parsed = parseDoneText(text);
  if (
    parsed.rpe == null &&
    parsed.rir == null &&
    parsed.soreness == null &&
    !parsed.notes
  ) {
    return "Could not parse anything. Try: /done rpe 8 rir 2 felt strong";
  }
  await saveDoneEntry(todayISO, parsed);
  const summary = [
    parsed.rpe != null ? `RPE ${parsed.rpe}` : null,
    parsed.rir != null ? `RIR ${parsed.rir}` : null,
    parsed.soreness != null ? `soreness ${parsed.soreness}` : null,
    parsed.notes ? `"${parsed.notes}"` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  return `✅ Logged: ${summary}`;
}

// ── /calendar ─────────────────────────────────────────────────────────────────

export async function handleCalendar(): Promise<string> {
  const snaps = (await listBiometricSnapshots(
    90,
  )) as import("@/lib/whoop").BiometricSnapshot[];
  const byDate = new Map<string, import("@/lib/whoop").BiometricSnapshot>();
  for (const s of snaps) byDate.set(s.date, s);

  const lines: string[] = ["📅 Recovery — last 90 days"];
  lines.push("Mon Tue Wed Thu Fri Sat Sun");

  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 90);
  // Adjust to Monday of that week (0=Sun, 1=Mon, ... 6=Sat)
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);

  const cursor = new Date(start);
  let row = "";
  let count = 0;
  while (cursor <= today) {
    const dateISO = cursor.toISOString().slice(0, 10);
    const snap = byDate.get(dateISO);
    let cell: string;
    if (
      !snap ||
      snap.recovery.status !== "scored" ||
      snap.recovery.score == null
    ) {
      cell = "⬜ ";
    } else if (snap.recovery.score >= 67) {
      cell = "🟢 ";
    } else if (snap.recovery.score >= 34) {
      cell = "🟡 ";
    } else {
      cell = "🔴 ";
    }
    row += cell;
    count++;
    if (count % 7 === 0) {
      lines.push(row.trimEnd());
      row = "";
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (row) lines.push(row.trimEnd());

  lines.push("");
  lines.push("🟢 ≥67%  🟡 34-66%  🔴 <34%  ⬜ no data");
  return lines.join("\n");
}

// ── /goal /goals ──────────────────────────────────────────────────────────────

const VALID_GOAL_FIELDS = new Set<GoalField>(["weight", "waist", "hrv", "rhr"]);

export async function handleGoal(
  field: string,
  valueText: string,
  _todayISO: string,
): Promise<string> {
  const f = field.trim().toLowerCase() as GoalField;
  if (!field.trim() || !VALID_GOAL_FIELDS.has(f)) {
    return "Usage: /goal <weight|waist|hrv|rhr> <value>\nExamples: /goal weight 75  /goal hrv 50";
  }
  const num = parseFloat(valueText.trim());
  if (isNaN(num) || num <= 0) {
    return `Usage: /goal ${f} <number>`;
  }
  await setGoal(f, num);
  const units: Record<GoalField, string> = {
    weight: "kg",
    waist: "cm",
    hrv: "ms",
    rhr: "bpm",
  };
  return `🎯 Goal set: ${f} ${num}${units[f]}`;
}

export async function handleGoals(todayISO: string): Promise<string> {
  const goals = await listAllGoals();

  // Fetch today's snapshot for HRV/RHR current values
  const snap = (await getBiometricSnapshot(todayISO)) as
    | import("@/lib/whoop").BiometricSnapshot
    | null;

  // Fetch most recent body measurements (last 30 days, take last entry)
  const [weightHistory, waistHistory] = await Promise.all([
    listBodyMeasurements("weight", 30),
    listBodyMeasurements("waist", 30),
  ]);
  const currentWeight =
    weightHistory.length > 0
      ? weightHistory[weightHistory.length - 1].value
      : null;
  const currentWaist =
    waistHistory.length > 0
      ? waistHistory[waistHistory.length - 1].value
      : null;

  const currentHrv = snap?.recovery?.hrv_rmssd_ms ?? null;
  const currentRhr = snap?.recovery?.rhr_bpm ?? null;

  const units: Record<GoalField, string> = {
    weight: "kg",
    waist: "cm",
    hrv: "ms",
    rhr: "bpm",
  };

  const lines: string[] = ["🎯 Goals"];

  const fields: GoalField[] = ["weight", "waist", "hrv", "rhr"];
  for (const f of fields) {
    const goal = goals[f];
    if (goal == null) {
      lines.push(`${f.charAt(0).toUpperCase() + f.slice(1)}: — (no goal set)`);
      continue;
    }

    // Determine current value
    let current: number | null = null;
    if (f === "hrv") current = currentHrv;
    else if (f === "rhr") current = currentRhr;
    else if (f === "weight") current = currentWeight;
    else if (f === "waist") current = currentWaist;

    if (current == null) {
      lines.push(
        `${f.charAt(0).toUpperCase() + f.slice(1)}: ${goal}${units[f]} (no current data)`,
      );
    } else {
      const delta = goal - current;
      const sign = delta >= 0 ? "+" : "";
      // For rhr lower is better; for hrv higher is better
      const direction =
        f === "rhr"
          ? delta < 0
            ? `${Math.abs(delta).toFixed(0)}bpm to lose`
            : `${delta.toFixed(0)}bpm above goal`
          : f === "hrv"
            ? delta > 0
              ? `${delta.toFixed(0)}ms to gain`
              : `${Math.abs(delta).toFixed(0)}ms above goal`
            : `${sign}${delta.toFixed(1)} to go`;
      lines.push(
        `${f.charAt(0).toUpperCase() + f.slice(1)}: ${goal}${units[f]} (today ${current} → ${direction})`,
      );
    }
  }

  return lines.join("\n");
}

// ── /protein ──────────────────────────────────────────────────────────────────

export async function handleProtein(
  arg: string,
  todayISO: string,
): Promise<string> {
  const trimmed = arg.trim().toLowerCase();
  if (trimmed === "y" || trimmed === "yes") {
    await setProtein(todayISO, true);
    return "Logged protein hit ✓";
  }
  if (trimmed === "n" || trimmed === "no") {
    await setProtein(todayISO, false);
    return "Logged protein miss.";
  }
  // No arg → show last 7 days hit rate
  const history = await listProtein(7);
  if (history.length === 0)
    return "No protein data yet. Use /protein y or /protein n.";
  const hits = history.filter((e) => e.hit).length;
  const rate = Math.round((hits / history.length) * 100);
  const sparks = history.map((e) => (e.hit ? "✅" : "❌")).join(" ");
  return [
    `🥩 Protein — last ${history.length} days`,
    sparks,
    `Hit rate: ${hits}/${history.length} (${rate}%)`,
  ].join("\n");
}

// ── /bedtime ──────────────────────────────────────────────────────────────────

/** Parse "HH:MM" → minutes since midnight, or null if invalid */
function parseBedtimeMinutes(time: string): number | null {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export async function handleBedtime(
  arg: string,
  todayISO: string,
): Promise<string> {
  const trimmed = arg.trim();
  if (trimmed) {
    // Any non-empty arg: must be valid HH:MM
    if (parseBedtimeMinutes(trimmed) === null) {
      return "Usage: /bedtime HH:MM  (e.g. /bedtime 23:15)";
    }
    await setBedtime(todayISO, trimmed);
    return `Bedtime logged: ${trimmed} ✓`;
  }
  // No arg → show last 7 days
  const history = await listBedtimes(7);
  if (history.length === 0) return "No bedtime data yet. Use /bedtime HH:MM.";
  const minutes = history
    .map((e) => parseBedtimeMinutes(e.time))
    .filter((m): m is number => m !== null);
  const avg = minutes.reduce((a, b) => a + b, 0) / minutes.length;
  const avgH = Math.floor(avg / 60);
  const avgM = Math.round(avg % 60);
  const variance =
    minutes.length > 1
      ? Math.sqrt(
          minutes.reduce((a, b) => a + (b - avg) ** 2, 0) / minutes.length,
        )
      : 0;
  const lines = [`🌙 Bedtime — last ${history.length} days`];
  for (const e of history) lines.push(`  ${e.date}: ${e.time}`);
  lines.push(
    `Avg: ${avgH.toString().padStart(2, "0")}:${avgM.toString().padStart(2, "0")}  σ ${variance.toFixed(0)}min`,
  );
  return lines.join("\n");
}

// ── /pain ─────────────────────────────────────────────────────────────────────

export async function handlePain(
  text: string,
  todayISO: string,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) {
    // Show last 7 days pain log
    const history = await listPainEntries(7);
    if (history.length === 0)
      return "No pain entries in last 7 days. Use /pain <area> <severity 1-10> [note].";
    const lines = ["🩺 Pain log — last 7 days"];
    for (const day of history) {
      for (const e of day.entries) {
        lines.push(
          `  ${day.date} ${e.area} ${e.severity}/10${e.note ? ` — ${e.note}` : ""}`,
        );
      }
    }
    return lines.join("\n");
  }

  // Parse: <area> <severity> [note...]
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return "Usage: /pain knee 5 sharp";
  const area = parts[0];
  const severity = parseInt(parts[1], 10);
  if (isNaN(severity) || severity < 1 || severity > 10) {
    return "Severity must be 1–10. Usage: /pain knee 5 sharp";
  }
  const note = parts.slice(2).join(" ");
  await addPainEntry(todayISO, { area, severity, note });
  return `Pain logged: ${area} ${severity}/10${note ? ` — ${note}` : ""}.`;
}

// ── /export ───────────────────────────────────────────────────────────────────

export async function handleExport(): Promise<string> {
  const months = await listArchiveMonths();
  if (months.length === 0)
    return "No archive data yet. Archive builds automatically from daily cron runs.";
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://training-coach-phi.vercel.app";
  const secret = process.env.DASHBOARD_SECRET ?? "";
  const url = `${baseUrl}/api/export?key=${secret}`;
  return [
    `📦 Archive: ${months.length} month(s) stored (${months.join(", ")})`,
    `Export: ${url}`,
  ].join("\n");
}
