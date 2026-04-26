import type { BiometricSnapshot } from "./whoop";

export interface Streaks {
  /** Consecutive days (walking back from most recent) with recovery.score >= 67. */
  green_recovery: number;
  /** Consecutive weekdays (Mon-Fri) without a /skip, walking back from most recent weekday. */
  no_skip: number;
  /** Longest run of consecutive green-recovery days in the full window. */
  best_green_recovery: number;
}

function isWeekday(dateISO: string): boolean {
  // UTC day: 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const d = new Date(dateISO + "T12:00:00Z").getUTCDay();
  return d >= 1 && d <= 5;
}

/**
 * Compute streaks from a list of snapshots (ascending by date) and a skip map.
 *
 * green_recovery: walks from the most recent snapshot backward; counts
 * consecutive days where recovery.status === 'scored' AND score >= 67.
 * Days with status !== 'scored' (pending, unscorable, no_record) terminate
 * the streak immediately.
 *
 * no_skip: walks from the most recent date backward; weekends are transparent
 * (skipped over without breaking or counting), only Mon-Fri days count.
 * A weekday where skipMap[date] === true terminates the streak.
 *
 * best_green_recovery: scans the full snapshot window for the longest
 * consecutive run of green days (scored && score >= 67).
 */
export function computeStreaks(
  snapshots: BiometricSnapshot[],
  skipMap: Record<string, boolean>,
): Streaks {
  // Sort descending (most recent first) for streak walks
  const desc = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  // ── green_recovery: consecutive days with recovery score >= 67 ──────────────
  let green_recovery = 0;
  for (const snap of desc) {
    if (snap.recovery.status === "scored" && (snap.recovery.score ?? 0) >= 67) {
      green_recovery++;
    } else {
      break;
    }
  }

  // ── no_skip: consecutive weekdays without a skip (weekends transparent) ─────
  // Build a sorted-descending list of all dates in the skipMap window
  const allDates = Object.keys(skipMap).sort().reverse();
  let no_skip = 0;
  for (const date of allDates) {
    if (!isWeekday(date)) {
      // Weekend: transparent — don't count, don't break
      continue;
    }
    if (skipMap[date]) {
      // This weekday was skipped — streak ends
      break;
    }
    no_skip++;
  }

  // ── best_green_recovery: longest run across the full ascending window ────────
  const asc = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  let best_green_recovery = 0;
  let current = 0;
  for (const snap of asc) {
    if (snap.recovery.status === "scored" && (snap.recovery.score ?? 0) >= 67) {
      current++;
      if (current > best_green_recovery) best_green_recovery = current;
    } else {
      current = 0;
    }
  }

  return { green_recovery, no_skip, best_green_recovery };
}
