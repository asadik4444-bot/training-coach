import type { Band } from "./recovery";

const GREEN_OPENERS = [
  "You're loaded.",
  "Green day — push.",
  "Recovery's there. Earn it.",
  "Full send.",
];
const YELLOW_OPENERS = [
  "Be smart today.",
  "Manageable. Cap intensity.",
  "Yellow — quality over volume.",
  "Hold the line.",
];
const RED_OPENERS = [
  "Body's flagging. Listen.",
  "Red day. Recovery first.",
  "Sympathetic load high. Back off.",
  "Your nervous system is asking for rest.",
];

/**
 * Returns a deterministic opener for the given recovery band.
 * Rotates by UTC date so the same day always returns the same opener.
 */
export function opener(band: Band): string {
  const pool =
    band === "green"
      ? GREEN_OPENERS
      : band === "yellow"
        ? YELLOW_OPENERS
        : RED_OPENERS;
  const day = new Date().getUTCDate();
  return pool[day % pool.length];
}

/**
 * Returns a streak encouragement cue for streakDays >= 3, empty string otherwise.
 */
export function streakCue(streakDays: number): string {
  if (streakDays >= 14)
    return `🔥 ${streakDays} consistent days. This is the real edge.`;
  if (streakDays >= 7) return `${streakDays} days in a row. Keep it.`;
  if (streakDays >= 3) return `Building momentum (${streakDays} days).`;
  return "";
}

/**
 * Returns an adherence note if the user skipped sessions this week, otherwise empty string.
 */
export function adherenceCue(skippedThisWeek: number): string {
  if (skippedThisWeek === 0) return "";
  if (skippedThisWeek === 1) return "One miss this week — fine. Hold the rest.";
  return `${skippedThisWeek} misses this week. The system is only as good as the show-up.`;
}

/**
 * Message to prepend when a deload week is triggered.
 */
export function deloadCelebrate(): string {
  return "Deload week earned. Reduce volume now so you can train harder later.";
}
