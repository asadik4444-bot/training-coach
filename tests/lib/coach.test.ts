import { describe, it, expect } from "vitest";
import { decideToday, detectDeloadNeed } from "../../src/lib/coach";
import type { Trends } from "../../src/lib/trends";

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

describe("decideToday — hard stop", () => {
  it("HRV 15%+ below baseline AND RHR +6bpm → hard_stop red", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_baseline_7day: 60,
      rhr_today_vs_baseline_bpm: 6, // >5
    };
    // todayHrvMs = 50 = 83.3% of 60 → below 85% threshold
    const result = decideToday("scored", 80, 50, trends);
    expect(result.band).toBe("red");
    expect(result.hard_stop).toBe(true);
    expect(result.intensity_multiplier).toBe(0);
    expect(result.emoji).toBe("🔴");
  });

  it("HRV 15%+ below baseline but RHR only +3bpm → NOT hard stop", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_baseline_7day: 60,
      rhr_today_vs_baseline_bpm: 3, // ≤5
    };
    const result = decideToday("scored", 80, 50, trends);
    // Should NOT be a hard stop — falls through to recovery score logic
    expect(result.hard_stop).toBe(false);
  });

  it("RHR +6bpm but HRV at baseline → NOT hard stop", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_baseline_7day: 60,
      rhr_today_vs_baseline_bpm: 6,
    };
    // todayHrvMs = 55 = 91.7% of 60 → above 85% threshold
    const result = decideToday("scored", 80, 55, trends);
    expect(result.hard_stop).toBe(false);
  });
});

describe("decideToday — recovery score thresholds", () => {
  it("Recovery 75 + HRV at baseline → green, multiplier 1.0", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_baseline_7day: 60,
      rhr_today_vs_baseline_bpm: 1,
    };
    // todayHrvMs = 60 = exactly at baseline (no override)
    const result = decideToday("scored", 75, 60, trends);
    expect(result.band).toBe("green");
    expect(result.intensity_multiplier).toBe(1.0);
    expect(result.hard_stop).toBe(false);
    expect(result.emoji).toBe("🟢");
  });

  it("Recovery 75 + HRV 20% below baseline → yellow override (no hard stop)", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_baseline_7day: 60,
      rhr_today_vs_baseline_bpm: 3, // ≤5, no hard stop
    };
    // todayHrvMs = 48 = 80% of 60 → below 85% threshold → override green→yellow
    const result = decideToday("scored", 75, 48, trends);
    expect(result.band).toBe("yellow");
    expect(result.hard_stop).toBe(false);
    expect(result.intensity_multiplier).toBe(0.7);
    expect(result.reason).toMatch(/HRV 15% below baseline/);
  });

  it("Recovery 50 → yellow", () => {
    const result = decideToday("scored", 50, null, NULL_TRENDS);
    expect(result.band).toBe("yellow");
    expect(result.intensity_multiplier).toBe(0.7);
    expect(result.hard_stop).toBe(false);
    expect(result.emoji).toBe("🟡");
  });

  it("Recovery 20 → red, not hard_stop", () => {
    const result = decideToday("scored", 20, null, NULL_TRENDS);
    expect(result.band).toBe("red");
    expect(result.hard_stop).toBe(false);
    expect(result.intensity_multiplier).toBe(0);
    expect(result.emoji).toBe("🔴");
  });

  it("Recovery exactly 67 → green", () => {
    const result = decideToday("scored", 67, null, NULL_TRENDS);
    expect(result.band).toBe("green");
    expect(result.intensity_multiplier).toBe(1.0);
  });

  it("Recovery exactly 34 → yellow", () => {
    const result = decideToday("scored", 34, null, NULL_TRENDS);
    expect(result.band).toBe("yellow");
    expect(result.intensity_multiplier).toBe(0.7);
  });

  it("Recovery exactly 33 → red", () => {
    const result = decideToday("scored", 33, null, NULL_TRENDS);
    expect(result.band).toBe("red");
    expect(result.intensity_multiplier).toBe(0);
  });
});

describe("decideToday — recovery status fallbacks", () => {
  it("Recovery pending → yellow with flag", () => {
    const result = decideToday("pending", null, null, NULL_TRENDS);
    expect(result.band).toBe("yellow");
    expect(result.hard_stop).toBe(false);
    expect(result.intensity_multiplier).toBe(0.7);
    expect(result.flags).toContain("recovery still pending");
    expect(result.emoji).toBe("🟡");
  });

  it("Recovery no_record → yellow with no recovery data flag", () => {
    const result = decideToday("no_record", null, null, NULL_TRENDS);
    expect(result.band).toBe("yellow");
    expect(result.flags).toContain("no recovery data");
  });

  it("Recovery unscorable → yellow with no recovery data flag", () => {
    const result = decideToday("unscorable", null, null, NULL_TRENDS);
    expect(result.band).toBe("yellow");
    expect(result.flags).toContain("no recovery data");
  });
});

describe("decideToday — advisory flags", () => {
  it("ACWR 1.5 → overreaching flag added but band unchanged (green recovery)", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      acwr: 1.5,
    };
    const result = decideToday("scored", 75, null, trends);
    expect(result.band).toBe("green");
    const acwrFlag = result.flags.find((f) => f.includes("ACWR"));
    expect(acwrFlag).toBeDefined();
    expect(acwrFlag).toMatch(/overreaching/);
    expect(acwrFlag).toMatch(/1\.50/);
  });

  it("ACWR 0.7 → detraining flag added", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      acwr: 0.7,
    };
    const result = decideToday("scored", 75, null, trends);
    const acwrFlag = result.flags.find((f) => f.includes("ACWR"));
    expect(acwrFlag).toBeDefined();
    expect(acwrFlag).toMatch(/detraining/);
    expect(acwrFlag).toMatch(/0\.70/);
  });

  it("Sleep debt 360min → sleep flag added", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      sleep_debt_min_7day: 360,
    };
    const result = decideToday("scored", 75, null, trends);
    const sleepFlag = result.flags.find((f) => f.includes("Sleep debt"));
    expect(sleepFlag).toBeDefined();
    expect(sleepFlag).toMatch(/360min/);
  });

  it("Sleep debt 300min (boundary) → no sleep flag", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      sleep_debt_min_7day: 300,
    };
    const result = decideToday("scored", 75, null, trends);
    const sleepFlag = result.flags.find((f) => f.includes("Sleep debt"));
    expect(sleepFlag).toBeUndefined();
  });

  it("ACWR in sweet spot (1.0) → no ACWR flag", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      acwr: 1.0,
    };
    const result = decideToday("scored", 75, null, trends);
    const acwrFlag = result.flags.find((f) => f.includes("ACWR"));
    expect(acwrFlag).toBeUndefined();
  });

  it("Multiple flags can be present simultaneously", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      acwr: 1.5,
      sleep_debt_min_7day: 360,
    };
    const result = decideToday("scored", 50, null, trends);
    expect(result.flags.length).toBeGreaterThanOrEqual(2);
    expect(result.flags.some((f) => f.includes("ACWR"))).toBe(true);
    expect(result.flags.some((f) => f.includes("Sleep debt"))).toBe(true);
  });
});

describe("decideToday — reason length", () => {
  it("hard stop reason is ≤80 chars", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_baseline_7day: 60,
      rhr_today_vs_baseline_bpm: 6,
    };
    const result = decideToday("scored", 80, 50, trends);
    expect(result.reason.length).toBeLessThanOrEqual(80);
  });
});

// ── detectDeloadNeed ──────────────────────────────────────────────────────────

describe("detectDeloadNeed", () => {
  it("no signals → not triggered", () => {
    const result = detectDeloadNeed(NULL_TRENDS);
    expect(result.triggered).toBe(false);
    expect(result.reasons).toHaveLength(0);
  });

  it("1 signal only (HRV) → not triggered (requires 2+)", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_today_vs_baseline_pct: -15, // < -10
    };
    const result = detectDeloadNeed(trends);
    expect(result.triggered).toBe(false);
    expect(result.reasons).toHaveLength(1);
    expect(result.reasons[0]).toMatch(/HRV/);
  });

  it("2 signals (HRV + RHR) → triggered", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_today_vs_baseline_pct: -12, // < -10
      rhr_today_vs_baseline_bpm: 6, // > 5
    };
    const result = detectDeloadNeed(trends);
    expect(result.triggered).toBe(true);
    expect(result.reasons).toHaveLength(2);
  });

  it("formats RHR delta with exactly 1 decimal place", () => {
    const trends: Trends = {
      ...NULL_TRENDS,
      hrv_today_vs_baseline_pct: -12, // < -10
      rhr_today_vs_baseline_bpm: 11.666666666666666, // > 5
    };
    const result = detectDeloadNeed(trends);
    expect(result.reasons).toContain("RHR up 11.7 bpm vs baseline");
  });

  it("all 4 signals → triggered with 4 reasons", () => {
    const trends: Trends = {
      hrv_baseline_7day: 50,
      hrv_today_vs_baseline_pct: -20,
      rhr_baseline_7day: 50,
      rhr_today_vs_baseline_bpm: 8,
      sleep_efficiency_avg_7day: null,
      sleep_debt_min_7day: 500, // > 420
      acwr: 1.5, // > 1.4
      strain_7day_avg: null,
      strain_28day_avg: null,
    };
    const result = detectDeloadNeed(trends);
    expect(result.triggered).toBe(true);
    expect(result.reasons).toHaveLength(4);
  });

  it("ACWR exactly at boundary 1.4 → no ACWR signal", () => {
    const trends: Trends = { ...NULL_TRENDS, acwr: 1.4 };
    const result = detectDeloadNeed(trends);
    expect(result.reasons.some((r) => r.includes("ACWR"))).toBe(false);
  });

  it("sleep debt exactly 420 → no sleep signal", () => {
    const trends: Trends = { ...NULL_TRENDS, sleep_debt_min_7day: 420 };
    const result = detectDeloadNeed(trends);
    expect(result.reasons.some((r) => r.includes("Sleep debt"))).toBe(false);
  });
});

// ── Pain gate ─────────────────────────────────────────────────────────────────

describe("decideToday — pain gate", () => {
  it("pain >= 8 → hard_stop red regardless of recovery score", () => {
    const result = decideToday("scored", 90, 60, NULL_TRENDS, 8);
    expect(result.band).toBe("red");
    expect(result.hard_stop).toBe(true);
    expect(result.intensity_multiplier).toBe(0);
    expect(result.reason).toContain("Pain 8/10");
  });

  it("pain = 10 → hard_stop red", () => {
    const result = decideToday("scored", 85, 55, NULL_TRENDS, 10);
    expect(result.hard_stop).toBe(true);
    expect(result.band).toBe("red");
  });

  it("pain = 6 with green recovery → downgrade to yellow", () => {
    const result = decideToday("scored", 80, null, NULL_TRENDS, 6);
    expect(result.band).toBe("yellow");
    expect(result.hard_stop).toBe(false);
    expect(result.flags.some((f) => f.includes("Pain 6/10"))).toBe(true);
  });

  it("pain = 7 with yellow recovery → stays yellow (pain flag added)", () => {
    const result = decideToday("scored", 50, null, NULL_TRENDS, 7);
    expect(result.band).toBe("yellow");
    expect(result.flags.some((f) => f.includes("Pain 7/10"))).toBe(true);
  });

  it("no pain parameter → normal decision (green)", () => {
    const result = decideToday("scored", 85, null, NULL_TRENDS);
    expect(result.band).toBe("green");
    expect(result.hard_stop).toBe(false);
  });

  it("pain = 5 → no downgrade, no pain flag", () => {
    const result = decideToday("scored", 80, null, NULL_TRENDS, 5);
    // Pain <6 should not trigger any pain gate
    expect(result.band).toBe("green");
    expect(result.flags.every((f) => !f.includes("Pain"))).toBe(true);
  });
});
