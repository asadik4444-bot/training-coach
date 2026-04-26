import { describe, it, expect } from "vitest";
import { computeTrends } from "../../src/lib/trends";
import type { BiometricSnapshot } from "../../src/lib/whoop";

// Helper to build a dated snapshot
function makeSnap(
  daysAgo: number,
  overrides: Partial<BiometricSnapshot> = {},
): BiometricSnapshot {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  const date = d.toISOString().slice(0, 10);
  return {
    date,
    recovery: { status: "no_record" },
    ...overrides,
  };
}

describe("computeTrends", () => {
  it("returns all-null Trends for empty snapshots", () => {
    const t = computeTrends([]);
    expect(t.hrv_baseline_7day).toBeNull();
    expect(t.hrv_today_vs_baseline_pct).toBeNull();
    expect(t.rhr_baseline_7day).toBeNull();
    expect(t.rhr_today_vs_baseline_bpm).toBeNull();
    expect(t.sleep_efficiency_avg_7day).toBeNull();
    expect(t.sleep_debt_min_7day).toBeNull();
    expect(t.acwr).toBeNull();
    expect(t.strain_7day_avg).toBeNull();
    expect(t.strain_28day_avg).toBeNull();
  });

  it("returns all-null baselines for a single-day snapshot (no 7-day window)", () => {
    const snaps = [
      makeSnap(0, {
        recovery: {
          status: "scored",
          score: 70,
          hrv_rmssd_ms: 55,
          rhr_bpm: 52,
        },
        sleep: {
          efficiency_pct: 90,
          consistency_pct: 80,
          performance_pct: 85,
          total_in_bed_min: 480,
          total_awake_min: 20,
          total_light_min: 120,
          total_sws_min: 90,
          total_rem_min: 100,
          respiratory_rate: 15,
        },
        cycle: { strain: 8, kilojoules: 1200, avg_hr: 60, max_hr: 140 },
      }),
    ];
    const t = computeTrends(snaps);
    // Baselines require days -7..-1; only today present so all null
    expect(t.hrv_baseline_7day).toBeNull();
    expect(t.hrv_today_vs_baseline_pct).toBeNull();
    expect(t.rhr_baseline_7day).toBeNull();
    expect(t.rhr_today_vs_baseline_bpm).toBeNull();
    expect(t.sleep_efficiency_avg_7day).toBeNull();
    expect(t.sleep_debt_min_7day).toBeNull();
    // Strain averages: only 1 snapshot with strain=8
    expect(t.strain_7day_avg).toBeCloseTo(8);
    expect(t.strain_28day_avg).toBeCloseTo(8);
    // ACWR: both windows have data → computed
    expect(t.acwr).toBeCloseTo(1.0);
  });

  it("computes HRV baseline and delta over 7+ days", () => {
    // Days 1-7 have hrv=50, day 0 (today) has hrv=60
    const snaps: BiometricSnapshot[] = [];
    for (let i = 7; i >= 1; i--) {
      snaps.push(
        makeSnap(i, { recovery: { status: "scored", hrv_rmssd_ms: 50 } }),
      );
    }
    snaps.push(
      makeSnap(0, { recovery: { status: "scored", hrv_rmssd_ms: 60 } }),
    );
    const t = computeTrends(snaps);
    expect(t.hrv_baseline_7day).toBeCloseTo(50);
    // (60 - 50) / 50 * 100 = 20%
    expect(t.hrv_today_vs_baseline_pct).toBeCloseTo(20);
  });

  it("computes RHR baseline and delta over 7+ days", () => {
    const snaps: BiometricSnapshot[] = [];
    for (let i = 7; i >= 1; i--) {
      snaps.push(makeSnap(i, { recovery: { status: "scored", rhr_bpm: 55 } }));
    }
    snaps.push(makeSnap(0, { recovery: { status: "scored", rhr_bpm: 58 } }));
    const t = computeTrends(snaps);
    expect(t.rhr_baseline_7day).toBeCloseTo(55);
    // 58 - 55 = +3 bpm
    expect(t.rhr_today_vs_baseline_bpm).toBeCloseTo(3);
  });

  it("computes sleep efficiency avg and debt over 7-day window", () => {
    // Days 1-7 have efficiency=80, total_in_bed=420min (7h → 60min debt each)
    const snaps: BiometricSnapshot[] = [];
    for (let i = 7; i >= 1; i--) {
      snaps.push(
        makeSnap(i, {
          sleep: {
            efficiency_pct: 80,
            consistency_pct: 75,
            performance_pct: 80,
            total_in_bed_min: 420,
            total_awake_min: 20,
            total_light_min: 100,
            total_sws_min: 90,
            total_rem_min: 80,
            respiratory_rate: 15,
          },
        }),
      );
    }
    snaps.push(makeSnap(0, {})); // today has no sleep
    const t = computeTrends(snaps);
    expect(t.sleep_efficiency_avg_7day).toBeCloseTo(80);
    // 7 days × (480 - 420) = 7 × 60 = 420 min debt
    expect(t.sleep_debt_min_7day).toBeCloseTo(420);
  });

  it("computes ACWR: 21 days strain=10 + 7 days strain=15 → ACWR ≈ 1.333", () => {
    const snaps: BiometricSnapshot[] = [];
    // Oldest 21 days: strain=10
    for (let i = 27; i >= 7; i--) {
      snaps.push(
        makeSnap(i, {
          cycle: { strain: 10, kilojoules: 1000, avg_hr: 65, max_hr: 150 },
        }),
      );
    }
    // Last 7 days (days 6..0): strain=15
    for (let i = 6; i >= 0; i--) {
      snaps.push(
        makeSnap(i, {
          cycle: { strain: 15, kilojoules: 1500, avg_hr: 70, max_hr: 160 },
        }),
      );
    }
    const t = computeTrends(snaps);
    // 7-day mean = 15
    expect(t.strain_7day_avg).toBeCloseTo(15);
    // 28-day mean = (21×10 + 7×15)/28 = (210+105)/28 = 315/28 = 11.25
    expect(t.strain_28day_avg).toBeCloseTo(11.25);
    // ACWR = 15 / 11.25 ≈ 1.333
    expect(t.acwr).toBeCloseTo(1.333, 2);
  });

  it("returns null ACWR when strain data is missing", () => {
    // Snapshots with no cycle data
    const snaps = [
      makeSnap(2, { recovery: { status: "scored", hrv_rmssd_ms: 50 } }),
      makeSnap(1, { recovery: { status: "scored", hrv_rmssd_ms: 55 } }),
    ];
    const t = computeTrends(snaps);
    expect(t.acwr).toBeNull();
    expect(t.strain_7day_avg).toBeNull();
    expect(t.strain_28day_avg).toBeNull();
  });

  it("excludes today from HRV/RHR/sleep baseline (days -7 to -1 only)", () => {
    // Days 1-7 hrv=40, today hrv=100 — baseline should still be 40
    const snaps: BiometricSnapshot[] = [];
    for (let i = 7; i >= 1; i--) {
      snaps.push(
        makeSnap(i, { recovery: { status: "scored", hrv_rmssd_ms: 40 } }),
      );
    }
    snaps.push(
      makeSnap(0, { recovery: { status: "scored", hrv_rmssd_ms: 100 } }),
    );
    const t = computeTrends(snaps);
    // Baseline should ignore today (hrv=100) and average the 7 prior days (all 40)
    expect(t.hrv_baseline_7day).toBeCloseTo(40);
    expect(t.hrv_today_vs_baseline_pct).toBeCloseTo(150); // (100-40)/40*100 = 150%
  });
});
