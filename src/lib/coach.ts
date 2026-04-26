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
 * HRV trend, Whoop recovery score, ACWR/sleep advisory signals, and pain.
 *
 * Apply rules in order; stop at first match for band determination.
 */
export function decideToday(
  recoveryStatus: "scored" | "pending" | "unscorable" | "no_record",
  recoveryScore: number | null, // 0-100 if scored, else null
  todayHrvMs: number | null, // today's HRV in ms
  trends: Trends, // from computeTrends — has 7-day baselines
  painSeverity?: number, // optional: max pain severity today (1-10)
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

  // ── Rule 0: Pain gate ────────────────────────────────────────────────────────
  // Hard-stop if pain >= 8; downgrade band if pain >= 6
  if (painSeverity !== undefined && painSeverity >= 8) {
    return {
      band: "red",
      emoji: "🔴",
      reason: `Pain ${painSeverity}/10 — hard stop, defer all training`,
      hard_stop: true,
      intensity_multiplier: 0,
      flags: [...flags, `Pain ${painSeverity}/10 — defer hard work`],
    };
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

  // ── Rule 6: Pain downgrade (moderate) ──────────────────────────────────────
  // Pain 6-7: downgrade green → yellow or yellow → yellow (add flag)
  if (painSeverity !== undefined && painSeverity >= 6) {
    if (band === "green") {
      band = "yellow";
      emoji = "🟡";
      reason = `Pain ${painSeverity}/10 — downgrading from green, defer hard work`;
      intensityMultiplier = 0.7;
    }
    flags.push(`Pain ${painSeverity}/10 — defer hard work`);
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

// ── Deload detection ──────────────────────────────────────────────────────────

export interface DeloadSignal {
  triggered: boolean;
  reasons: string[]; // human-readable reasons
}

/**
 * Detect chronic overreaching from trends. Requires 2+ signals to fire.
 */
export function detectDeloadNeed(trends: Trends): DeloadSignal {
  const reasons: string[] = [];

  // 14-day HRV chronic decline
  if (
    trends.hrv_today_vs_baseline_pct != null &&
    trends.hrv_today_vs_baseline_pct < -10
  ) {
    reasons.push(
      `HRV ${Math.abs(trends.hrv_today_vs_baseline_pct).toFixed(0)}% below baseline`,
    );
  }

  // RHR drift up
  if (
    trends.rhr_today_vs_baseline_bpm != null &&
    trends.rhr_today_vs_baseline_bpm > 5
  ) {
    reasons.push(`RHR up ${trends.rhr_today_vs_baseline_bpm} bpm vs baseline`);
  }

  // ACWR sustained high
  if (trends.acwr != null && trends.acwr > 1.4) {
    reasons.push(`ACWR ${trends.acwr.toFixed(2)} (>1.4 sustained)`);
  }

  // Sleep debt
  if (trends.sleep_debt_min_7day != null && trends.sleep_debt_min_7day > 420) {
    reasons.push(
      `Sleep debt ${Math.round(trends.sleep_debt_min_7day)}min (>7h cumulative)`,
    );
  }

  return {
    triggered: reasons.length >= 2,
    reasons,
  };
}
