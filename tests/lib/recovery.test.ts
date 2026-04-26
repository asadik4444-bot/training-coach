import { describe, it, expect } from "vitest";
import { classifyRecovery } from "../../src/lib/recovery";

describe("classifyRecovery", () => {
  it("returns green at 67% and above", () => {
    expect(classifyRecovery(67).band).toBe("green");
    expect(classifyRecovery(95).band).toBe("green");
  });
  it("returns yellow between 34% and 66%", () => {
    expect(classifyRecovery(50).band).toBe("yellow");
    expect(classifyRecovery(34).band).toBe("yellow");
    expect(classifyRecovery(66).band).toBe("yellow");
  });
  it("returns red below 34%", () => {
    expect(classifyRecovery(20).band).toBe("red");
    expect(classifyRecovery(0).band).toBe("red");
  });
  it("attaches an emoji per band", () => {
    expect(classifyRecovery(80).emoji).toBe("🟢");
    expect(classifyRecovery(50).emoji).toBe("🟡");
    expect(classifyRecovery(10).emoji).toBe("🔴");
  });
});
