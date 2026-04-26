import yaml from "js-yaml";

export type DayType = "lift" | "run";
export interface PlanDay {
  type: DayType;
  focus?: string;
  summary: string;
}
export interface Plan {
  week_start: string;
  days: Record<string, PlanDay>;
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function parsePlan(source: string): Plan {
  return yaml.load(source) as Plan;
}

export function pickToday(plan: Plan, weekdayIndex: number): PlanDay | null {
  const name = WEEKDAY_NAMES[weekdayIndex];
  return plan.days[name] ?? null;
}
