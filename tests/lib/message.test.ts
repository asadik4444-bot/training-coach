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
});
