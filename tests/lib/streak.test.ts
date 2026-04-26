import { describe, it, expect } from "vitest";
import { computeStreaks } from "../../src/lib/streak";
import type { BiometricSnapshot } from "../../src/lib/whoop";

function snap(
  date: string,
  score?: number,
  status: BiometricSnapshot["recovery"]["status"] = "scored",
): BiometricSnapshot {
  return {
    date,
    recovery:
      status === "scored" && score != null
        ? { status: "scored", score }
        : { status },
  };
}

// Build a skip map from an array of skipped dates
function skipMap(
  skipped: string[] = [],
  allDates: string[] = [],
): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const d of allDates) map[d] = false;
  for (const d of skipped) map[d] = true;
  return map;
}

describe("computeStreaks — empty data", () => {
  it("returns zeroes when snapshots array is empty", () => {
    const s = computeStreaks([], {});
    expect(s.green_recovery).toBe(0);
    expect(s.no_skip).toBe(0);
    expect(s.best_green_recovery).toBe(0);
  });
});

describe("computeStreaks — all-green snapshots", () => {
  it("counts every consecutive green day", () => {
    // 2026-04-20 Mon through 2026-04-24 Fri — all scored >= 67
    const snaps = [
      snap("2026-04-20", 70),
      snap("2026-04-21", 75),
      snap("2026-04-22", 80),
      snap("2026-04-23", 68),
      snap("2026-04-24", 72),
    ];
    const dates = snaps.map((s) => s.date);
    const s = computeStreaks(snaps, skipMap([], dates));
    expect(s.green_recovery).toBe(5);
    expect(s.best_green_recovery).toBe(5);
  });
});

describe("computeStreaks — broken streak", () => {
  it("stops green_recovery at first non-green day", () => {
    // Most recent first when sorted desc: 04-24(green), 04-23(red), 04-22(green)
    const snaps = [
      snap("2026-04-22", 70),
      snap("2026-04-23", 20), // not green — breaks streak
      snap("2026-04-24", 80),
    ];
    const s = computeStreaks(snaps, {});
    expect(s.green_recovery).toBe(1); // only 04-24 before the break
    expect(s.best_green_recovery).toBe(1); // longest individual run is 1
  });

  it("best_green_recovery captures the longer historical run", () => {
    // Run of 3 green, then 1 red, then 1 green (most recent)
    const snaps = [
      snap("2026-04-19", 70),
      snap("2026-04-20", 72),
      snap("2026-04-21", 68),
      snap("2026-04-22", 20), // red — breaks the run
      snap("2026-04-23", 80), // new run of 1
    ];
    const s = computeStreaks(snaps, {});
    expect(s.green_recovery).toBe(1);
    expect(s.best_green_recovery).toBe(3);
  });
});

describe("computeStreaks — missing days (unscorable / no_record)", () => {
  it("treats unscorable status as non-green (terminates streak)", () => {
    const snaps = [
      snap("2026-04-22", undefined, "no_record"),
      snap("2026-04-23", undefined, "unscorable"),
      snap("2026-04-24", 80, "scored"),
    ];
    const s = computeStreaks(snaps, {});
    // Most recent 04-24 is green, 04-23 is unscorable → streak stops at 1
    expect(s.green_recovery).toBe(1);
  });

  it("treats pending status as non-green (terminates streak)", () => {
    const snaps = [
      snap("2026-04-23", 75, "scored"),
      snap("2026-04-24", undefined, "pending"), // today not yet scored
    ];
    const s = computeStreaks(snaps, {});
    // Most recent is pending — streak = 0
    expect(s.green_recovery).toBe(0);
  });
});

describe("computeStreaks — weekend exclusion for no_skip", () => {
  it("weekends do not count or break the no_skip streak", () => {
    // Week of 2026-04-20 (Mon) .. 2026-04-26 (Sun)
    // Mon-Fri: not skipped; Sat+Sun: in map but weekend
    const dates = [
      "2026-04-20", // Mon
      "2026-04-21", // Tue
      "2026-04-22", // Wed
      "2026-04-23", // Thu
      "2026-04-24", // Fri
      "2026-04-25", // Sat — should be transparent
      "2026-04-26", // Sun — should be transparent
    ];
    const s = computeStreaks([], skipMap([], dates));
    // 5 weekdays, 0 skipped → no_skip = 5 (weekends don't add or subtract)
    expect(s.no_skip).toBe(5);
  });

  it("a skipped weekday terminates no_skip streak", () => {
    const dates = [
      "2026-04-20", // Mon
      "2026-04-21", // Tue (skipped)
      "2026-04-22", // Wed
      "2026-04-23", // Thu
      "2026-04-24", // Fri
    ];
    const s = computeStreaks([], skipMap(["2026-04-21"], dates));
    // Walking back from Fri: Thu(ok), Wed(ok), Tue(skipped) → stop
    // Fri=1, Thu=2, Wed=3, Tue=skipped → no_skip = 3
    expect(s.no_skip).toBe(3);
  });
});
