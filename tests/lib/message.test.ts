import { describe, it, expect } from "vitest";
import { composeMessage } from "../../src/lib/message";

describe("composeMessage", () => {
  it("green recovery + lift day", () => {
    const msg = composeMessage(78, {
      type: "lift",
      focus: "chest",
      summary: "Bench 4x8",
    });
    expect(msg).toContain("🟢");
    expect(msg).toContain("78");
    expect(msg).toContain("Bench 4x8");
  });
  it("red recovery overrides plan with rest cue", () => {
    const msg = composeMessage(25, { type: "lift", summary: "Squat 4x6" });
    expect(msg).toContain("🔴");
    expect(msg).toMatch(/walk|mobility|rest/i);
    expect(msg).not.toContain("Squat 4x6");
  });
  it("null plan day (weekend) returns rest message", () => {
    const msg = composeMessage(70, null);
    expect(msg).toMatch(/rest|off/i);
  });
  it("yellow recovery on a lift day contains 'cut last set'", () => {
    const msg = composeMessage(55, { type: "lift", summary: "Bench 4x8" });
    expect(msg).toContain("cut last set");
    expect(msg).not.toContain("zone 2");
  });
  it("yellow recovery on a run day contains zone 2 cue and not 'cut last set'", () => {
    const msg = composeMessage(55, { type: "run", summary: "Z2 run 45 min" });
    expect(msg).toMatch(/easy|zone 2/i);
    expect(msg).not.toContain("cut last set");
  });
});
