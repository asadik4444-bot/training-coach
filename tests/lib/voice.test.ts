import { describe, it, expect } from "vitest";
import { opener, streakCue, adherenceCue, deloadCelebrate } from "@/lib/voice";

describe("opener", () => {
  it("returns a non-empty string for green", () => {
    expect(opener("green")).toBeTruthy();
  });

  it("returns a non-empty string for yellow", () => {
    expect(opener("yellow")).toBeTruthy();
  });

  it("returns a non-empty string for red", () => {
    expect(opener("red")).toBeTruthy();
  });

  it("is deterministic — same day always returns same value", () => {
    // Call twice: should be identical (day doesn't change between calls)
    expect(opener("green")).toBe(opener("green"));
    expect(opener("yellow")).toBe(opener("yellow"));
    expect(opener("red")).toBe(opener("red"));
  });

  it("returns different pools for green vs red", () => {
    // At least one date where they differ — they always should since pools are distinct
    const g = opener("green");
    const r = opener("red");
    // Pools don't overlap by design
    expect(g).not.toEqual(r);
  });
});

describe("streakCue", () => {
  it("returns empty string for streaks under 3", () => {
    expect(streakCue(0)).toBe("");
    expect(streakCue(2)).toBe("");
  });

  it("returns momentum message for 3-6 days", () => {
    expect(streakCue(3)).toContain("3");
    expect(streakCue(5)).toContain("5");
  });

  it("returns keep-it message for 7-13 days", () => {
    const msg = streakCue(7);
    expect(msg).toContain("7");
    expect(msg).toContain("Keep it");
  });

  it("returns real-edge message for 14+ days", () => {
    const msg = streakCue(14);
    expect(msg).toContain("14");
    expect(msg).toContain("real edge");
  });

  it("includes streak count in message", () => {
    expect(streakCue(21)).toContain("21");
  });
});

describe("adherenceCue", () => {
  it("returns empty string for 0 skips", () => {
    expect(adherenceCue(0)).toBe("");
  });

  it("returns fine message for 1 skip", () => {
    const msg = adherenceCue(1);
    expect(msg).toContain("One miss");
    expect(msg).toContain("fine");
  });

  it("returns warning for 2+ skips", () => {
    const msg2 = adherenceCue(2);
    expect(msg2).toContain("2 misses");
    const msg3 = adherenceCue(3);
    expect(msg3).toContain("3 misses");
  });
});

describe("deloadCelebrate", () => {
  it("returns a non-empty message", () => {
    expect(deloadCelebrate()).toBeTruthy();
  });

  it("mentions deload in the message", () => {
    expect(deloadCelebrate().toLowerCase()).toContain("deload");
  });
});
