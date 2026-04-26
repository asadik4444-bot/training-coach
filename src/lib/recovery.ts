export type Band = "green" | "yellow" | "red";

export interface Classification {
  band: Band;
  emoji: string;
  multiplier: number;
}

export function classifyRecovery(score: number): Classification {
  if (score >= 67) return { band: "green", emoji: "🟢", multiplier: 1.0 };
  if (score >= 34) return { band: "yellow", emoji: "🟡", multiplier: 0.7 };
  return { band: "red", emoji: "🔴", multiplier: 0.0 };
}
