import { describe, it, expect } from "vitest";
import { pickToday, parsePlan } from "../../src/lib/plan";

const yaml = `
week_start: 2026-04-27
days:
  monday:    { type: lift, focus: chest, summary: "Bench 4x8" }
  tuesday:   { type: run, summary: "45 min Z2" }
  wednesday: { type: lift, focus: legs, summary: "Squat 4x6" }
  thursday:  { type: run, summary: "Intervals" }
  friday:    { type: lift, focus: pull, summary: "Deadlift 3x5" }
`;

describe("plan", () => {
  it("parses yaml into structured plan", () => {
    const plan = parsePlan(yaml);
    expect(plan.days.monday.type).toBe("lift");
    expect(plan.days.tuesday.summary).toBe("45 min Z2");
  });

  it("picks today by 0=Sun..6=Sat weekday index", () => {
    const plan = parsePlan(yaml);
    expect(pickToday(plan, 1)?.summary).toBe("Bench 4x8"); // Monday
    expect(pickToday(plan, 2)?.summary).toBe("45 min Z2"); // Tuesday
    expect(pickToday(plan, 5)?.summary).toBe("Deadlift 3x5"); // Friday
  });

  it("returns null for weekend (Sat/Sun)", () => {
    const plan = parsePlan(yaml);
    expect(pickToday(plan, 0)).toBeNull(); // Sunday
    expect(pickToday(plan, 6)).toBeNull(); // Saturday
  });
});
