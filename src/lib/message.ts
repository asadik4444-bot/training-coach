import { classifyRecovery } from "./recovery";
import type { PlanDay } from "./plan";

export function composeMessage(
  recoveryPct: number,
  today: PlanDay | null,
): string {
  const c = classifyRecovery(recoveryPct);
  const head = `${c.emoji} Recovery ${recoveryPct}%`;

  if (!today) return `${head}. Rest day — see you Monday.`;

  if (c.band === "red") {
    return `${head}. Skip planned ${today.type}. Z2 walk 30 min + mobility only.`;
  }

  if (c.band === "yellow") {
    const note =
      today.type === "run"
        ? " (yellow — drop pace to easy, cap at HR zone 2)"
        : " (yellow — 70% volume; cut last set of each)";
    return `${head}. Today: ${today.summary}${note}.`;
  }
  return `${head}. Today: ${today.summary}.`;
}
