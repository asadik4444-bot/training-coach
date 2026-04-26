import type { BiometricSnapshot } from "./whoop";

export interface DailyMetrics {
  date: string;
  hrv?: number;
  rhr?: number;
  recovery?: number;
  sleep_eff?: number;
  sleep_min?: number;
  strain?: number;
  zone_minutes?: {
    z0: number;
    z1: number;
    z2: number;
    z3: number;
    z4: number;
    z5: number;
  };
}

/** Convert BiometricSnapshot list to flat DailyMetrics rows (one per day). */
export function toMetrics(snaps: BiometricSnapshot[]): DailyMetrics[] {
  return snaps.map((snap) => {
    const m: DailyMetrics = { date: snap.date };
    if (typeof snap.recovery.hrv_rmssd_ms === "number")
      m.hrv = snap.recovery.hrv_rmssd_ms;
    if (typeof snap.recovery.rhr_bpm === "number")
      m.rhr = snap.recovery.rhr_bpm;
    if (typeof snap.recovery.score === "number")
      m.recovery = snap.recovery.score;
    if (snap.sleep) {
      m.sleep_eff = snap.sleep.efficiency_pct;
      m.sleep_min = snap.sleep.total_in_bed_min;
    }
    if (snap.cycle) {
      m.strain = snap.cycle.strain;
    }
    if (snap.last_workout?.zone_minutes) {
      m.zone_minutes = { ...snap.last_workout.zone_minutes };
    }
    return m;
  });
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

/**
 * Unicode sparkline. Null values render as ' ' (space). Min/max auto-scaled.
 */
export function sparkline(values: (number | null)[]): string {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return "";
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const range = max - min || 1;
  return values
    .map((v) => {
      if (v == null) return " ";
      const idx = Math.min(
        BLOCKS.length - 1,
        Math.floor(((v - min) / range) * BLOCKS.length),
      );
      return BLOCKS[idx];
    })
    .join("");
}

// ── Summarize ─────────────────────────────────────────────────────────────────

export interface MetricSummary {
  field: string;
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
  latest: number | null;
  delta_from_avg: number | null; // latest - avg
  cv_pct: number | null; // coefficient of variation (stdev/mean*100), sample stdev
  spark: string; // sparkline of all values (nulls for missing days)
}

function sampleStdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function summarize(
  metrics: DailyMetrics[],
  field: "hrv" | "rhr" | "recovery" | "sleep_eff" | "sleep_min" | "strain",
): MetricSummary {
  const allValues: (number | null)[] = metrics.map((m) => m[field] ?? null);
  const present = allValues.filter((v): v is number => v !== null);

  if (present.length === 0) {
    return {
      field,
      count: 0,
      min: null,
      max: null,
      avg: null,
      latest: null,
      delta_from_avg: null,
      cv_pct: null,
      spark: sparkline(allValues),
    };
  }

  const min = Math.min(...present);
  const max = Math.max(...present);
  const avg = present.reduce((a, b) => a + b, 0) / present.length;

  // "latest" = last non-null value in chronological order
  const latest = present[present.length - 1];
  const delta_from_avg = latest - avg;

  const stdev = sampleStdev(present);
  const cv_pct = stdev !== null && avg !== 0 ? (stdev / avg) * 100 : null;

  return {
    field,
    count: present.length,
    min,
    max,
    avg,
    latest,
    delta_from_avg,
    cv_pct,
    spark: sparkline(allValues),
  };
}

// ── Polarized Analysis ────────────────────────────────────────────────────────

export interface PolarizedAnalysis {
  low_min: number; // Z1 + Z2 minutes
  high_min: number; // Z3 + Z4 + Z5 minutes
  ratio: number | null; // low/high (null if no high)
  compliance: "polarized" | "pyramidal" | "threshold" | "unknown";
}

/**
 * Seiler's 80/20 polarized analysis across all days with zone data.
 * - polarized: ratio >= 4 (proper 80/20)
 * - pyramidal: 2 <= ratio < 4
 * - threshold: ratio < 2 (too much moderate-intensity grind)
 * - unknown: low_min + high_min == 0
 */
export function polarizedAnalysis(metrics: DailyMetrics[]): PolarizedAnalysis {
  let low_min = 0;
  let high_min = 0;

  for (const m of metrics) {
    if (!m.zone_minutes) continue;
    const z = m.zone_minutes;
    low_min += (z.z1 ?? 0) + (z.z2 ?? 0);
    high_min += (z.z3 ?? 0) + (z.z4 ?? 0) + (z.z5 ?? 0);
  }

  if (low_min + high_min === 0) {
    return { low_min: 0, high_min: 0, ratio: null, compliance: "unknown" };
  }

  const ratio = high_min === 0 ? null : low_min / high_min;

  let compliance: PolarizedAnalysis["compliance"];
  if (ratio === null) {
    compliance = "polarized"; // all low, no high — technically polarized
  } else if (ratio >= 4) {
    compliance = "polarized";
  } else if (ratio >= 2) {
    compliance = "pyramidal";
  } else {
    compliance = "threshold";
  }

  return { low_min, high_min, ratio, compliance };
}
