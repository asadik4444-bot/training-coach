import type { Trends } from "./trends";

export type Band = "green" | "yellow" | "red";

export interface DailyDecision {
  band: Band;
  emoji: string; // 🟢 / 🟡 / 🔴
  reason: string; // one human-readable sentence citing the dominant signal
  hard_stop: boolean; // true → user MUST rest regardless of plan
  intensity_multiplier: number; // 1.0 / 0.7 / 0.0
  flags: string[]; // additional advisory notes (sleep debt, ACWR high, etc)
}

/**
 * Pure decision engine — no side effects. Returns a recommendation based on
 * HRV trend, Whoop recovery score, and ACWR/sleep advisory signals.
 *
 * Apply rules in order; stop at first match for band determination.
 */
export function decideToday(
  recoveryStatus: "scored" | "pending" | "unscorable" | "no_record",
  recoveryScore: number | null, // 0-100 if scored, else null
  todayHrvMs: number | null, // today's HRV in ms
  trends: Trends, // from computeTrends — has 7-day baselines
): DailyDecision {
  // Build advisory flags (applied regardless of band)
  const flags: string[] = [];

  if (trends.acwr !== null && trends.acwr > 1.3) {
    flags.push(
      `ACWR ${trends.acwr.toFixed(2)} — overreaching risk, consider deload`,
    );
  } else if (trends.acwr !== null && trends.acwr < 0.8) {
    flags.push(
      `ACWR ${trends.acwr.toFixed(2)} — detraining risk, consider extra session`,
    );
  }

  if (trends.sleep_debt_min_7day !== null && trends.sleep_debt_min_7day > 300) {
    flags.push(
      `Sleep debt ${Math.round(trends.sleep_debt_min_7day)}min over last 7 days`,
    );
  }

  // ── Rule 1: Hard-stop (BOTH autonomic signals critical) ────────────────────
  // HRV ≥15% below baseline AND RHR elevated >5bpm — both autonomic signals say rest
  if (
    todayHrvMs !== null &&
    trends.hrv_baseline_7day !== null &&
    todayHrvMs < trends.hrv_baseline_7day * 0.85 &&
    trends.rhr_today_vs_baseline_bpm !== null &&
    trends.rhr_today_vs_baseline_bpm > 5
  ) {
    return {
      band: "red",
      emoji: "🔴",
      reason:
        "HRV 15%+ below baseline AND RHR up >5bpm — both autonomic signals say rest",
      hard_stop: true,
      intensity_multiplier: 0,
      flags,
    };
  }

  // ── Rule 2: Recovery still pending ─────────────────────────────────────────
  if (recoveryStatus === "pending") {
    return {
      band: "yellow",
      emoji: "🟡",
      reason: "Whoop still computing recovery — defaulting to moderate",
      hard_stop: false,
      intensity_multiplier: 0.7,
      flags: [...flags, "recovery still pending"],
    };
  }

  // ── Rule 3: No usable recovery data ─────────────────────────────────────────
  if (recoveryStatus === "no_record" || recoveryStatus === "unscorable") {
    return {
      band: "yellow",
      emoji: "🟡",
      reason: "No usable Whoop recovery — moderate session",
      hard_stop: false,
      intensity_multiplier: 0.7,
      flags: [...flags, "no recovery data"],
    };
  }

  // ── Rule 4: Recovery score thresholds (Whoop's own model) ──────────────────
  let band: Band;
  let emoji: string;
  let reason: string;
  let intensityMultiplier: number;

  const score = recoveryScore ?? 0;

  if (score >= 67) {
    band = "green";
    emoji = "🟢";
    reason = `Recovery ${score}% — green, execute as planned`;
    intensityMultiplier = 1.0;
  } else if (score >= 34) {
    band = "yellow";
    emoji = "🟡";
    reason = `Recovery ${score}% — moderate, ease off`;
    intensityMultiplier = 0.7;
  } else {
    band = "red";
    emoji = "🔴";
    reason = `Recovery ${score}% — low, active recovery only`;
    intensityMultiplier = 0.0;
  }

  // ── Rule 5: HRV override on green ──────────────────────────────────────────
  // If green but HRV is suppressed ≥15% below baseline, downgrade to yellow
  if (
    band === "green" &&
    todayHrvMs !== null &&
    trends.hrv_baseline_7day !== null &&
    todayHrvMs < trends.hrv_baseline_7day * 0.85
  ) {
    band = "yellow";
    emoji = "🟡";
    reason = "Recovery green but HRV 15% below baseline — easing off.";
    intensityMultiplier = 0.7;
  }

  return {
    band,
    emoji,
    reason,
    hard_stop: false,
    intensity_multiplier: intensityMultiplier,
    flags,
  };
}
