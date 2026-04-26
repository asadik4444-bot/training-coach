import { appendDailyLog, setSkipped, setSwap } from "@/lib/kv";

const VALID_DAYS = new Set([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);

export async function handleLog(
  text: string,
  todayISO: string,
): Promise<string> {
  const entry = text.trim();
  if (!entry) return "Usage: /log <entry>";
  await appendDailyLog(todayISO, entry);
  return `Logged: ${entry}`;
}

export async function handleSkip(todayISO: string): Promise<string> {
  await setSkipped(todayISO);
  return "Marked today as skipped. Recovery-aware progression resumes Monday.";
}

export async function handleSwap(
  target: string,
  todayISO: string,
): Promise<string> {
  const day = target.trim().toLowerCase();
  if (!VALID_DAYS.has(day)) {
    return "Swap target must be monday–friday";
  }
  await setSwap(todayISO, day);
  return `Swapped: today's session is now ${day}'s plan`;
}
