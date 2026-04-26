import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLog, handleSkip, handleSwap } from "../../src/lib/commands";

vi.mock("@/lib/kv", () => ({
  appendDailyLog: vi.fn().mockResolvedValue(undefined),
  setSkipped: vi.fn().mockResolvedValue(undefined),
  setSwap: vi.fn().mockResolvedValue(undefined),
}));

import { appendDailyLog, setSkipped, setSwap } from "@/lib/kv";

const TODAY = "2026-04-26";

beforeEach(() => {
  vi.clearAllMocks();
});

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
