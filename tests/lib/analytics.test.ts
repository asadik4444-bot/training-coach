import { describe, it, expect } from "vitest";
import {
  sparkline,
  summarize,
  polarizedAnalysis,
  toMetrics,
} from "../../src/lib/analytics";
import type { BiometricSnapshot } from "../../src/lib/whoop";

// ── sparkline ─────────────────────────────────────────────────────────────────

describe("sparkline", () => {
  it("returns empty string for empty array", () => {
    expect(sparkline([])).toBe("");
  });

  it("returns empty string for all-null array", () => {
    expect(sparkline([null, null, null])).toBe("");
  });

  it("returns all middle block when all values are the same (range=0 → treated as 1)", () => {
    // With range=0 forced to 1, idx = floor(0/1 * 8) = 0 → ▁
    const result = sparkline([5, 5, 5]);
    expect(result).toBe("▁▁▁");
  });

  it("ascending [1,2,3,4,5] → ▁▃▅▇█", () => {
    // v=1→idx=0(▁), v=2→idx=2(▃), v=3→idx=4(▅), v=4→idx=6(▇), v=5→idx=7(█)
    expect(sparkline([1, 2, 3, 4, 5])).toBe("▁▃▅▇█");
  });

  it("null values render as space in the output", () => {
    const result = sparkline([1, null, 5]);
    expect(result[1]).toBe(" ");
    expect(result).toBe("▁ █");
  });

  it("single non-null value renders as ▁ (min = max → range = 0 → idx = 0)", () => {
    expect(sparkline([42])).toBe("▁");
  });

  it("mixed values produce correct length output", () => {
    const vals = [10, null, 20, null, 30];
    const result = sparkline(vals);
    expect(result).toHaveLength(5);
  });
});

// ── summarize ─────────────────────────────────────────────────────────────────

const EMPTY_METRICS = [{ date: "2026-04-20" }, { date: "2026-04-21" }];

describe("summarize", () => {
  it("returns all-null summary for empty metrics array", () => {
    const s = summarize([], "hrv");
    expect(s.count).toBe(0);
    expect(s.min).toBeNull();
    expect(s.max).toBeNull();
    expect(s.avg).toBeNull();
    expect(s.latest).toBeNull();
    expect(s.delta_from_avg).toBeNull();
    expect(s.cv_pct).toBeNull();
  });

  it("returns all-null summary when field is missing in all rows", () => {
    const s = summarize(EMPTY_METRICS, "hrv");
    expect(s.count).toBe(0);
    expect(s.avg).toBeNull();
  });

  it("computes correct min/max/avg/latest/cv for 7 values", () => {
    const metrics = [
      { date: "2026-04-20", hrv: 40 },
      { date: "2026-04-21", hrv: 42 },
      { date: "2026-04-22", hrv: 38 },
      { date: "2026-04-23", hrv: 45 },
      { date: "2026-04-24", hrv: 41 },
      { date: "2026-04-25", hrv: 43 },
      { date: "2026-04-26", hrv: 36 },
    ];
    const s = summarize(metrics, "hrv");
    expect(s.count).toBe(7);
    expect(s.min).toBe(36);
    expect(s.max).toBe(45);
    expect(s.avg).toBeCloseTo((40 + 42 + 38 + 45 + 41 + 43 + 36) / 7, 2);
    expect(s.latest).toBe(36); // last in array
    expect(s.delta_from_avg).toBeCloseTo(
      36 - (40 + 42 + 38 + 45 + 41 + 43 + 36) / 7,
      2,
    );
    expect(s.cv_pct).not.toBeNull();
    expect(s.cv_pct!).toBeGreaterThan(0);
    expect(s.spark).toHaveLength(7);
  });

  it("delta_from_avg is latest - avg", () => {
    const metrics = [
      { date: "2026-04-25", hrv: 50 },
      { date: "2026-04-26", hrv: 60 },
    ];
    const s = summarize(metrics, "hrv");
    expect(s.avg).toBeCloseTo(55);
    expect(s.latest).toBe(60);
    expect(s.delta_from_avg).toBeCloseTo(5);
  });

  it("cv_pct is null for single value (sample stdev requires n≥2)", () => {
    const metrics = [{ date: "2026-04-26", hrv: 42 }];
    const s = summarize(metrics, "hrv");
    expect(s.cv_pct).toBeNull();
  });

  it("spark includes space for null positions", () => {
    const metrics = [
      { date: "2026-04-24", hrv: 40 },
      { date: "2026-04-25" }, // no hrv
      { date: "2026-04-26", hrv: 50 },
    ];
    const s = summarize(metrics, "hrv");
    expect(s.spark[1]).toBe(" ");
  });
});

// ── polarizedAnalysis ─────────────────────────────────────────────────────────

describe("polarizedAnalysis", () => {
  it("returns unknown when no zone data exists", () => {
    const metrics = [{ date: "2026-04-26" }, { date: "2026-04-25" }];
    const pa = polarizedAnalysis(metrics);
    expect(pa.compliance).toBe("unknown");
    expect(pa.ratio).toBeNull();
    expect(pa.low_min).toBe(0);
    expect(pa.high_min).toBe(0);
  });

  it("80 min Z2 + 20 min Z4 → ratio 4, polarized", () => {
    const metrics = [
      {
        date: "2026-04-26",
        zone_minutes: { z0: 0, z1: 0, z2: 80, z3: 0, z4: 20, z5: 0 },
      },
    ];
    const pa = polarizedAnalysis(metrics);
    expect(pa.low_min).toBe(80);
    expect(pa.high_min).toBe(20);
    expect(pa.ratio).toBeCloseTo(4);
    expect(pa.compliance).toBe("polarized");
  });

  it("50/50 split → ratio 1, threshold", () => {
    const metrics = [
      {
        date: "2026-04-26",
        zone_minutes: { z0: 0, z1: 0, z2: 50, z3: 50, z4: 0, z5: 0 },
      },
    ];
    const pa = polarizedAnalysis(metrics);
    expect(pa.ratio).toBeCloseTo(1);
    expect(pa.compliance).toBe("threshold");
  });

  it("ratio 2 exactly → pyramidal boundary", () => {
    const metrics = [
      {
        date: "2026-04-26",
        zone_minutes: { z0: 0, z1: 40, z2: 20, z3: 30, z4: 0, z5: 0 },
      },
    ];
    const pa = polarizedAnalysis(metrics);
    expect(pa.low_min).toBe(60); // z1+z2
    expect(pa.high_min).toBe(30); // z3
    expect(pa.ratio).toBeCloseTo(2);
    expect(pa.compliance).toBe("pyramidal");
  });

  it("ratio 3.9 → pyramidal (not yet polarized)", () => {
    const metrics = [
      {
        date: "2026-04-26",
        zone_minutes: { z0: 0, z1: 0, z2: 39, z3: 10, z4: 0, z5: 0 },
      },
    ];
    const pa = polarizedAnalysis(metrics);
    expect(pa.ratio).toBeCloseTo(3.9);
    expect(pa.compliance).toBe("pyramidal");
  });

  it("sums zone_minutes across multiple days", () => {
    const metrics = [
      {
        date: "2026-04-25",
        zone_minutes: { z0: 0, z1: 0, z2: 40, z3: 10, z4: 0, z5: 0 },
      },
      {
        date: "2026-04-26",
        zone_minutes: { z0: 0, z1: 0, z2: 40, z3: 10, z4: 0, z5: 0 },
      },
    ];
    const pa = polarizedAnalysis(metrics);
    expect(pa.low_min).toBe(80);
    expect(pa.high_min).toBe(20);
    expect(pa.ratio).toBeCloseTo(4);
    expect(pa.compliance).toBe("polarized");
  });
});

// ── toMetrics ─────────────────────────────────────────────────────────────────

describe("toMetrics", () => {
  const fullSnap: BiometricSnapshot = {
    date: "2026-04-26",
    recovery: {
      status: "scored",
      score: 72,
      hrv_rmssd_ms: 45,
      rhr_bpm: 52,
    },
    sleep: {
      efficiency_pct: 88,
      consistency_pct: 80,
      performance_pct: 85,
      total_in_bed_min: 470,
      total_awake_min: 25,
      total_light_min: 120,
      total_sws_min: 90,
      total_rem_min: 100,
      respiratory_rate: 15,
    },
    cycle: { strain: 11.2, kilojoules: 1500, avg_hr: 65, max_hr: 155 },
    last_workout: {
      sport: "Running",
      strain: 10.1,
      avg_hr: 142,
      max_hr: 172,
      zone_minutes: { z0: 2, z1: 5, z2: 28, z3: 12, z4: 4, z5: 0 },
      distance_meters: 8000,
      start: "2026-04-26T07:00:00Z",
    },
  };

  it("converts full BiometricSnapshot to DailyMetrics with all fields", () => {
    const [m] = toMetrics([fullSnap]);
    expect(m.date).toBe("2026-04-26");
    expect(m.hrv).toBe(45);
    expect(m.rhr).toBe(52);
    expect(m.recovery).toBe(72);
    expect(m.sleep_eff).toBe(88);
    expect(m.sleep_min).toBe(470);
    expect(m.strain).toBe(11.2);
    expect(m.zone_minutes).toEqual({
      z0: 2,
      z1: 5,
      z2: 28,
      z3: 12,
      z4: 4,
      z5: 0,
    });
  });

  it("converts snapshot with only recovery scored — other fields absent", () => {
    const snap: BiometricSnapshot = {
      date: "2026-04-25",
      recovery: { status: "scored", score: 65 },
    };
    const [m] = toMetrics([snap]);
    expect(m.date).toBe("2026-04-25");
    expect(m.recovery).toBe(65);
    expect(m.hrv).toBeUndefined();
    expect(m.rhr).toBeUndefined();
    expect(m.sleep_eff).toBeUndefined();
    expect(m.sleep_min).toBeUndefined();
    expect(m.strain).toBeUndefined();
    expect(m.zone_minutes).toBeUndefined();
  });

  it("returns empty array for empty input", () => {
    expect(toMetrics([])).toEqual([]);
  });
});
