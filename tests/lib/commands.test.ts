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
} from "../../src/lib/commands";
import type { BiometricSnapshot } from "../../src/lib/whoop";

vi.mock("@/lib/kv", () => ({
  appendDailyLog: vi.fn().mockResolvedValue(undefined),
  setSkipped: vi.fn().mockResolvedValue(undefined),
  setSwap: vi.fn().mockResolvedValue(undefined),
  getBiometricSnapshot: vi.fn().mockResolvedValue(null),
  listBiometricSnapshots: vi.fn().mockResolvedValue([]),
}));

import {
  appendDailyLog,
  setSkipped,
  setSwap,
  listBiometricSnapshots,
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
  it("returns string under 800 chars listing key commands", async () => {
    const reply = await handleHelp();
    expect(reply.length).toBeLessThan(800);
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
