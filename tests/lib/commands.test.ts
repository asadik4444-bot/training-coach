import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  handleLog,
  handleSkip,
  handleSwap,
  handleHelp,
  handleHrv,
  handleRhr,
  handleSleep,
  handleZones,
  handleLoad,
  handleReport,
  handleRecent,
  handleSetup,
  handleWeight,
  handleWaist,
  handleBody,
  handleDone,
  parseDoneText,
  handleGoal,
  handleGoals,
} from "../../src/lib/commands";
import type { BiometricSnapshot } from "../../src/lib/whoop";

vi.mock("@/lib/kv", () => ({
  appendDailyLog: vi.fn().mockResolvedValue(undefined),
  setSkipped: vi.fn().mockResolvedValue(undefined),
  setSwap: vi.fn().mockResolvedValue(undefined),
  getBiometricSnapshot: vi.fn().mockResolvedValue(null),
  listBiometricSnapshots: vi.fn().mockResolvedValue([]),
  setBodyMeasurement: vi.fn().mockResolvedValue(undefined),
  getBodyMeasurement: vi.fn().mockResolvedValue(null),
  listBodyMeasurements: vi.fn().mockResolvedValue([]),
  isSkipped: vi.fn().mockResolvedValue(false),
  saveDoneEntry: vi.fn().mockResolvedValue(undefined),
  getDoneEntry: vi.fn().mockResolvedValue(null),
  listDoneEntries: vi.fn().mockResolvedValue([]),
  setGoal: vi.fn().mockResolvedValue(undefined),
  getGoal: vi.fn().mockResolvedValue(null),
  listAllGoals: vi.fn().mockResolvedValue({
    weight: null,
    waist: null,
    hrv: null,
    rhr: null,
  }),
}));

import {
  appendDailyLog,
  setSkipped,
  setSwap,
  listBiometricSnapshots,
  setBodyMeasurement,
  listBodyMeasurements,
  saveDoneEntry,
  setGoal,
  listAllGoals,
} from "@/lib/kv";

const TODAY = "2026-04-26";

beforeEach(() => {
  vi.clearAllMocks();
});

// ── existing tests ────────────────────────────────────────────────────────────

describe("handleLog", () => {
  it("stores entry and returns confirmation", async () => {
    const reply = await handleLog("ran 5km", TODAY);
    expect(reply).toBe("Logged: ran 5km");
    expect(vi.mocked(appendDailyLog)).toHaveBeenCalledWith(TODAY, "ran 5km");
  });

  it("trims whitespace from entry", async () => {
    const reply = await handleLog("  bench press  ", TODAY);
    expect(reply).toBe("Logged: bench press");
    expect(vi.mocked(appendDailyLog)).toHaveBeenCalledWith(
      TODAY,
      "bench press",
    );
  });

  it("rejects empty entry", async () => {
    const reply = await handleLog("", TODAY);
    expect(reply).toBe("Usage: /log <entry>");
    expect(vi.mocked(appendDailyLog)).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only entry", async () => {
    const reply = await handleLog("   ", TODAY);
    expect(reply).toBe("Usage: /log <entry>");
    expect(vi.mocked(appendDailyLog)).not.toHaveBeenCalled();
  });
});

describe("handleSkip", () => {
  it("marks today as skipped and returns message", async () => {
    const reply = await handleSkip(TODAY);
    expect(reply).toBe(
      "Marked today as skipped. Recovery-aware progression resumes Monday.",
    );
    expect(vi.mocked(setSkipped)).toHaveBeenCalledWith(TODAY);
  });
});

describe("handleSwap", () => {
  it("swaps to a valid day", async () => {
    const reply = await handleSwap("friday", TODAY);
    expect(reply).toBe("Swapped: today's session is now friday's plan");
    expect(vi.mocked(setSwap)).toHaveBeenCalledWith(TODAY, "friday");
  });

  it("normalises input to lowercase", async () => {
    const reply = await handleSwap("Monday", TODAY);
    expect(reply).toBe("Swapped: today's session is now monday's plan");
    expect(vi.mocked(setSwap)).toHaveBeenCalledWith(TODAY, "monday");
  });

  it("trims whitespace before validating", async () => {
    const reply = await handleSwap("  wednesday  ", TODAY);
    expect(reply).toBe("Swapped: today's session is now wednesday's plan");
  });

  it("rejects weekend day", async () => {
    const reply = await handleSwap("saturday", TODAY);
    expect(reply).toBe("Swap target must be monday–friday");
    expect(vi.mocked(setSwap)).not.toHaveBeenCalled();
  });

  it("rejects invalid string", async () => {
    const reply = await handleSwap("legday", TODAY);
    expect(reply).toBe("Swap target must be monday–friday");
    expect(vi.mocked(setSwap)).not.toHaveBeenCalled();
  });

  it("rejects empty string", async () => {
    const reply = await handleSwap("", TODAY);
    expect(reply).toBe("Swap target must be monday–friday");
    expect(vi.mocked(setSwap)).not.toHaveBeenCalled();
  });
});

// ── new command tests ─────────────────────────────────────────────────────────

describe("handleHelp", () => {
  it("returns string under 1200 chars listing key commands", async () => {
    const reply = await handleHelp();
    expect(reply.length).toBeLessThan(1200);
    expect(reply).toContain("/today");
    expect(reply).toContain("/hrv");
    expect(reply).toContain("/report");
    expect(reply).toContain("/backfill");
  });
});

describe("handleHrv", () => {
  it("returns no-data message when KV is empty", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleHrv(7, TODAY);
    expect(reply).toContain("No HRV data");
  });

  it("formats HRV summary with sparkline when data present", async () => {
    const snaps: BiometricSnapshot[] = [
      { date: "2026-04-20", recovery: { status: "scored", hrv_rmssd_ms: 40 } },
      { date: "2026-04-21", recovery: { status: "scored", hrv_rmssd_ms: 45 } },
      { date: "2026-04-22", recovery: { status: "scored", hrv_rmssd_ms: 38 } },
    ];
    vi.mocked(listBiometricSnapshots).mockResolvedValue(snaps);
    const reply = await handleHrv(7, TODAY);
    expect(reply).toContain("HRV");
    expect(reply).toContain("ms");
    expect(reply).toContain("Trend:");
  });
});

describe("handleRhr", () => {
  it("returns no-data message when KV is empty", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleRhr(7, TODAY);
    expect(reply).toContain("No RHR data");
  });
});

describe("handleSleep", () => {
  it("returns no-data message when KV is empty", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleSleep(7, TODAY);
    expect(reply).toContain("No sleep data");
  });
});

describe("handleZones", () => {
  it("returns no-data message when no zone data", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleZones(7, TODAY);
    expect(reply).toContain("No zone data");
  });

  it("formats polarized analysis when zone data present", async () => {
    const snaps: BiometricSnapshot[] = [
      {
        date: "2026-04-26",
        recovery: { status: "no_record" },
        last_workout: {
          sport: "Running",
          strain: 10,
          avg_hr: 140,
          max_hr: 170,
          zone_minutes: { z0: 0, z1: 0, z2: 80, z3: 0, z4: 20, z5: 0 },
          start: "2026-04-26T07:00:00Z",
        },
      },
    ];
    vi.mocked(listBiometricSnapshots).mockResolvedValue(snaps);
    const reply = await handleZones(7, TODAY);
    expect(reply).toContain("HR zones");
    expect(reply).toContain("Ratio:");
    expect(reply).toContain("polarized");
  });
});

describe("handleLoad", () => {
  it("returns no-data message when KV is empty", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleLoad(TODAY);
    expect(reply).toContain("No strain data");
  });

  it("shows ACWR sweet spot when strain in healthy range", async () => {
    // Generate 28 snapshots with dates relative to today so computeTrends sees them
    const snaps: BiometricSnapshot[] = Array.from({ length: 28 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      return {
        date: d.toISOString().slice(0, 10),
        recovery: { status: "scored" as const },
        cycle: { strain: 10, kilojoules: 1200, avg_hr: 65, max_hr: 155 },
      };
    });
    vi.mocked(listBiometricSnapshots).mockResolvedValue(snaps);
    const reply = await handleLoad(TODAY);
    expect(reply).toContain("ACWR:");
    expect(reply).toContain("sweet spot");
  });
});

describe("handleReport", () => {
  it("returns no-data message when KV is empty", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleReport("week", TODAY);
    expect(reply).toContain("No data");
  });

  it("week report includes recovery, HRV, sparklines", async () => {
    const snaps: BiometricSnapshot[] = [
      {
        date: "2026-04-20",
        recovery: { status: "scored", score: 72, hrv_rmssd_ms: 42 },
      },
      {
        date: "2026-04-21",
        recovery: { status: "scored", score: 68, hrv_rmssd_ms: 45 },
      },
    ];
    vi.mocked(listBiometricSnapshots).mockResolvedValue(snaps);
    const reply = await handleReport("week", TODAY);
    expect(reply).toContain("Week report");
    expect(reply).toContain("Recovery:");
    expect(reply).toContain("HRV:");
    expect(reply.length).toBeLessThan(4000);
  });

  it("year report includes Monthly breakdown section", async () => {
    const snaps: BiometricSnapshot[] = [
      {
        date: "2026-01-15",
        recovery: { status: "scored", score: 70, hrv_rmssd_ms: 40 },
      },
      {
        date: "2026-02-15",
        recovery: { status: "scored", score: 65, hrv_rmssd_ms: 38 },
      },
    ];
    vi.mocked(listBiometricSnapshots).mockResolvedValue(snaps);
    const reply = await handleReport("year", TODAY);
    expect(reply).toContain("Monthly breakdown");
    expect(reply).toContain("2026-0");
  });
});

describe("handleRecent", () => {
  it("returns no-workouts message when KV is empty", async () => {
    vi.mocked(listBiometricSnapshots).mockResolvedValue([]);
    const reply = await handleRecent(5, TODAY);
    expect(reply).toContain("No workouts found");
  });

  it("returns last N workouts sorted by date descending", async () => {
    const snaps: BiometricSnapshot[] = [
      {
        date: "2026-04-24",
        recovery: { status: "no_record" },
        last_workout: {
          sport: "Running",
          strain: 9.5,
          avg_hr: 138,
          max_hr: 165,
          zone_minutes: { z0: 0, z1: 0, z2: 25, z3: 10, z4: 5, z5: 0 },
          start: "2026-04-24T07:00:00Z",
        },
      },
      {
        date: "2026-04-25",
        recovery: { status: "no_record" },
        last_workout: {
          sport: "Functional Fitness",
          strain: 11.2,
          avg_hr: 145,
          max_hr: 175,
          zone_minutes: { z0: 0, z1: 0, z2: 22, z3: 18, z4: 6, z5: 0 },
          start: "2026-04-25T07:00:00Z",
        },
      },
    ];
    vi.mocked(listBiometricSnapshots).mockResolvedValue(snaps);
    const reply = await handleRecent(5, TODAY);
    expect(reply).toContain("2026-04-25");
    expect(reply).toContain("Functional Fitness");
    expect(reply).toContain("Running");
    // Most recent first
    expect(reply.indexOf("2026-04-25")).toBeLessThan(
      reply.indexOf("2026-04-24"),
    );
  });
});

// ── /setup ────────────────────────────────────────────────────────────────────

describe("handleSetup", () => {
  it("calls backfill internally and includes onboarding tips in the reply", async () => {
    // Mock fetch for the internal backfill HTTP call
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          stored: 87,
          range: { startISO: "2026-01-26", endISO: "2026-04-26" },
        }),
        { status: 200 },
      ),
    );

    const reply = await handleSetup();

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(reply).toContain("87");
    expect(reply).toContain("/today");
    expect(reply).toContain("/report month");

    fetchSpy.mockRestore();
  });

  it("propagates backfill failure message gracefully", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "token expired" }), {
        status: 200,
      }),
    );

    const reply = await handleSetup();
    expect(reply).toContain("failed");

    fetchSpy.mockRestore();
  });
});

// ── /weight ───────────────────────────────────────────────────────────────────

describe("handleWeight", () => {
  it("logs a valid weight and returns confirmation", async () => {
    const reply = await handleWeight("79.4", TODAY);
    expect(reply).toBe(`Logged weight 79.4kg for ${TODAY}.`);
    expect(vi.mocked(setBodyMeasurement)).toHaveBeenCalledWith(
      TODAY,
      "weight",
      79.4,
    );
  });

  it("rejects weight below 30", async () => {
    const reply = await handleWeight("20", TODAY);
    expect(reply).toContain("Usage:");
    expect(vi.mocked(setBodyMeasurement)).not.toHaveBeenCalled();
  });

  it("rejects non-numeric input", async () => {
    const reply = await handleWeight("heavy", TODAY);
    expect(reply).toContain("Usage:");
    expect(vi.mocked(setBodyMeasurement)).not.toHaveBeenCalled();
  });

  it("rejects weight above 250", async () => {
    const reply = await handleWeight("300", TODAY);
    expect(reply).toContain("Usage:");
  });
});

// ── /waist ────────────────────────────────────────────────────────────────────

describe("handleWaist", () => {
  it("logs a valid waist measurement", async () => {
    const reply = await handleWaist("84", TODAY);
    expect(reply).toBe(`Logged waist 84cm for ${TODAY}.`);
    expect(vi.mocked(setBodyMeasurement)).toHaveBeenCalledWith(
      TODAY,
      "waist",
      84,
    );
  });

  it("rejects waist above 200", async () => {
    const reply = await handleWaist("250", TODAY);
    expect(reply).toContain("Usage:");
  });
});

// ── /body ─────────────────────────────────────────────────────────────────────

describe("handleBody", () => {
  it("returns no-data message when no measurements logged", async () => {
    vi.mocked(listBodyMeasurements).mockResolvedValue([]);
    const reply = await handleBody(30);
    expect(reply).toContain("No body measurements");
    expect(reply).toContain("/weight");
  });

  it("shows weight trend when weight data present", async () => {
    vi.mocked(listBodyMeasurements).mockImplementation(
      async (field: "weight" | "waist") => {
        if (field === "weight") {
          return [
            { date: "2026-03-27", value: 80.0 },
            { date: "2026-04-26", value: 78.5 },
          ];
        }
        return [];
      },
    );
    const reply = await handleBody(30);
    expect(reply).toContain("Weight:");
    expect(reply).toContain("78.5kg");
    expect(reply).toContain("-1.5");
  });

  it("shows both weight and waist when both logged", async () => {
    vi.mocked(listBodyMeasurements).mockImplementation(
      async (field: "weight" | "waist") => {
        if (field === "weight") return [{ date: "2026-04-26", value: 79.0 }];
        return [{ date: "2026-04-26", value: 85.0 }];
      },
    );
    const reply = await handleBody(30);
    expect(reply).toContain("Weight:");
    expect(reply).toContain("Waist:");
  });
});

// ── parseDoneText ─────────────────────────────────────────────────────────────

describe("parseDoneText", () => {
  it("parses RPE only", () => {
    const r = parseDoneText("rpe 8");
    expect(r.rpe).toBe(8);
    expect(r.rir).toBeUndefined();
    expect(r.soreness).toBeUndefined();
    expect(r.notes).toBeUndefined();
  });

  it("parses RPE, RIR, and soreness together", () => {
    const r = parseDoneText("rpe 8 rir 2 soreness 5");
    expect(r.rpe).toBe(8);
    expect(r.rir).toBe(2);
    expect(r.soreness).toBe(5);
    expect(r.notes).toBeUndefined();
  });

  it("parses notes as everything not matched by keywords", () => {
    const r = parseDoneText("bench 80x8 RPE 8");
    expect(r.rpe).toBe(8);
    expect(r.notes).toContain("bench 80x8");
  });

  it("is case-insensitive for keywords", () => {
    const r = parseDoneText("RPE 9 RIR 1 SORENESS 3");
    expect(r.rpe).toBe(9);
    expect(r.rir).toBe(1);
    expect(r.soreness).toBe(3);
  });

  it("handles decimal values", () => {
    const r = parseDoneText("rpe 8.5");
    expect(r.rpe).toBe(8.5);
  });

  it("returns empty object when nothing parseable", () => {
    const r = parseDoneText("hello world");
    expect(r.rpe).toBeUndefined();
    expect(r.rir).toBeUndefined();
    expect(r.soreness).toBeUndefined();
    expect(r.notes).toBe("hello world");
  });
});

// ── handleDone ────────────────────────────────────────────────────────────────

describe("handleDone", () => {
  it("returns usage message on empty text", async () => {
    const reply = await handleDone("", TODAY);
    expect(reply).toContain("Usage:");
    expect(vi.mocked(saveDoneEntry)).not.toHaveBeenCalled();
  });

  it("logs RPE and returns confirmation", async () => {
    const reply = await handleDone("rpe 8", TODAY);
    expect(reply).toContain("RPE 8");
    expect(vi.mocked(saveDoneEntry)).toHaveBeenCalledWith(TODAY, {
      rpe: 8,
    });
  });

  it("logs all three metrics and free-form notes", async () => {
    const reply = await handleDone("rpe 8 rir 2 soreness 5 felt strong", TODAY);
    expect(reply).toContain("RPE 8");
    expect(reply).toContain("RIR 2");
    expect(reply).toContain("soreness 5");
    expect(reply).toContain("felt strong");
    expect(vi.mocked(saveDoneEntry)).toHaveBeenCalledWith(TODAY, {
      rpe: 8,
      rir: 2,
      soreness: 5,
      notes: "felt strong",
    });
  });

  it("returns error when text has no parseable data", async () => {
    // Pass whitespace text which fails the trim check
    const reply = await handleDone("   ", TODAY);
    expect(reply).toContain("Usage:");
  });
});

// ── handleGoal ────────────────────────────────────────────────────────────────

describe("handleGoal", () => {
  it("sets a valid weight goal and returns confirmation", async () => {
    const reply = await handleGoal("weight", "75", TODAY);
    expect(reply).toContain("75kg");
    expect(vi.mocked(setGoal)).toHaveBeenCalledWith("weight", 75);
  });

  it("sets an HRV goal with ms unit", async () => {
    const reply = await handleGoal("hrv", "50", TODAY);
    expect(reply).toContain("50ms");
    expect(vi.mocked(setGoal)).toHaveBeenCalledWith("hrv", 50);
  });

  it("rejects unknown field", async () => {
    const reply = await handleGoal("bodyfat", "15", TODAY);
    expect(reply).toContain("Usage:");
    expect(vi.mocked(setGoal)).not.toHaveBeenCalled();
  });

  it("rejects non-numeric value", async () => {
    const reply = await handleGoal("weight", "heavy", TODAY);
    expect(reply).toContain("Usage:");
    expect(vi.mocked(setGoal)).not.toHaveBeenCalled();
  });

  it("rejects zero value", async () => {
    const reply = await handleGoal("rhr", "0", TODAY);
    expect(reply).toContain("Usage:");
    expect(vi.mocked(setGoal)).not.toHaveBeenCalled();
  });
});

// ── handleGoals ───────────────────────────────────────────────────────────────

describe("handleGoals", () => {
  it("shows all goals as unset when none configured", async () => {
    vi.mocked(listAllGoals).mockResolvedValue({
      weight: null,
      waist: null,
      hrv: null,
      rhr: null,
    });
    const reply = await handleGoals(TODAY);
    expect(reply).toContain("Goals");
    expect(reply).toContain("no goal set");
  });

  it("shows set goals with no current data when snap is missing", async () => {
    vi.mocked(listAllGoals).mockResolvedValue({
      weight: 75,
      waist: 80,
      hrv: 50,
      rhr: 50,
    });
    const reply = await handleGoals(TODAY);
    expect(reply).toContain("75kg");
    expect(reply).toContain("no current data");
  });
});
