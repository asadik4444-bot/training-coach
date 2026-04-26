import type { BiometricSnapshot } from "./whoop";

export type { BiometricSnapshot };

export interface Trends {
  hrv_baseline_7day: number | null; // mean HRV (ms) over days -7..-1
  hrv_today_vs_baseline_pct: number | null; // (today - baseline) / baseline * 100
  rhr_baseline_7day: number | null;
  rhr_today_vs_baseline_bpm: number | null;
  sleep_efficiency_avg_7day: number | null; // avg over days -7..-1
  sleep_debt_min_7day: number | null; // shortfall from 480 min target × 7 days
  acwr: number | null; // acute (7-day strain avg) / chronic (28-day strain avg)
  strain_7day_avg: number | null;
  strain_28day_avg: number | null;
}

const NULL_TRENDS: Trends = {
  hrv_baseline_7day: null,
  hrv_today_vs_baseline_pct: null,
  rhr_baseline_7day: null,
  rhr_today_vs_baseline_bpm: null,
  sleep_efficiency_avg_7day: null,
  sleep_debt_min_7day: null,
  acwr: null,
  strain_7day_avg: null,
  strain_28day_avg: null,
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Determine how many days ago a snapshot is relative to today (UTC date).
 * Returns 0 for today, 1 for yesterday, etc.
 * Returns null if the date cannot be parsed or is in the future.
 */
function daysAgo(snapDate: string): number | null {
  const todayStr = new Date().toISOString().slice(0, 10);
  const today = new Date(todayStr + "T00:00:00Z").getTime();
  const snap = new Date(snapDate + "T00:00:00Z").getTime();
  const diff = Math.round((today - snap) / (24 * 3600 * 1000));
  if (diff < 0) return null; // future date — ignore
  return diff;
}

/**
 * Compute biometric trends from a list of snapshots (up to 28 days).
 * - Baselines (HRV, RHR, sleep) use days -7..-1 (exclude today).
 * - Strain averages and ACWR include all days in respective windows.
 */
export function computeTrends(snapshots: BiometricSnapshot[]): Trends {
  if (snapshots.length === 0) return { ...NULL_TRENDS };

  // Build lookup by daysAgo
  const byDaysAgo = new Map<number, BiometricSnapshot>();
  for (const snap of snapshots) {
    const d = daysAgo(snap.date);
    if (d !== null) byDaysAgo.set(d, snap);
  }

  // ── HRV & RHR baselines (days 1..7, i.e. -7..-1) ─────────────────────────
  const hrvBaseline: number[] = [];
  const rhrBaseline: number[] = [];
  for (let d = 1; d <= 7; d++) {
    const snap = byDaysAgo.get(d);
    if (!snap) continue;
    const hrv = snap.recovery.hrv_rmssd_ms;
    const rhr = snap.recovery.rhr_bpm;
    if (typeof hrv === "number") hrvBaseline.push(hrv);
    if (typeof rhr === "number") rhrBaseline.push(rhr);
  }

  const hrvBaselineVal = mean(hrvBaseline);
  const rhrBaselineVal = mean(rhrBaseline);

  // Today's HRV / RHR
  const todaySnap = byDaysAgo.get(0);
  const todayHrv = todaySnap?.recovery?.hrv_rmssd_ms ?? null;
  const todayRhr = todaySnap?.recovery?.rhr_bpm ?? null;

  const hrvTodayVsBaseline =
    todayHrv !== null && hrvBaselineVal !== null && hrvBaselineVal !== 0
      ? ((todayHrv - hrvBaselineVal) / hrvBaselineVal) * 100
      : null;

  const rhrTodayVsBaseline =
    todayRhr !== null && rhrBaselineVal !== null
      ? todayRhr - rhrBaselineVal
      : null;

  // ── Sleep baseline (days 1..7) ─────────────────────────────────────────────
  const sleepEfficiencies: number[] = [];
  const sleepInBedMins: number[] = [];
  for (let d = 1; d <= 7; d++) {
    const snap = byDaysAgo.get(d);
    if (!snap?.sleep) continue;
    sleepEfficiencies.push(snap.sleep.efficiency_pct);
    sleepInBedMins.push(snap.sleep.total_in_bed_min);
  }

  const sleepEfficiencyAvg = mean(sleepEfficiencies);
  const sleepDebt =
    sleepInBedMins.length > 0
      ? sleepInBedMins.reduce((acc, min) => acc + Math.max(0, 480 - min), 0)
      : null;

  // ── Strain averages (include all days in window) ───────────────────────────
  const strain7: number[] = [];
  const strain28: number[] = [];
  for (let d = 0; d <= 27; d++) {
    const snap = byDaysAgo.get(d);
    if (!snap?.cycle) continue;
    strain28.push(snap.cycle.strain);
    if (d <= 6) strain7.push(snap.cycle.strain);
  }

  const strain7Avg = mean(strain7);
  const strain28Avg = mean(strain28);
  const acwr =
    strain7Avg !== null && strain28Avg !== null && strain28Avg !== 0
      ? strain7Avg / strain28Avg
      : null;

  return {
    hrv_baseline_7day: hrvBaselineVal,
    hrv_today_vs_baseline_pct: hrvTodayVsBaseline,
    rhr_baseline_7day: rhrBaselineVal,
    rhr_today_vs_baseline_bpm: rhrTodayVsBaseline,
    sleep_efficiency_avg_7day: sleepEfficiencyAvg,
    sleep_debt_min_7day: sleepDebt,
    acwr,
    strain_7day_avg: strain7Avg,
    strain_28day_avg: strain28Avg,
  };
}
