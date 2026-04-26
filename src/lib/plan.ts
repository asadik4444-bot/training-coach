import yaml from "js-yaml";
import { z } from "zod";

const DayTypeSchema = z.enum(["lift", "run"]);

const PlanDaySchema = z
  .object({
    type: DayTypeSchema,
    focus: z.string().optional(),
    summary: z.string(),
  })
  .strict();

export const PlanSchema = z
  .object({
    week_start: z.string(),
    phase: z.string().optional(),
    days: z.record(z.string(), PlanDaySchema),
  })
  .strict();

export type DayType = z.infer<typeof DayTypeSchema>;
export type PlanDay = z.infer<typeof PlanDaySchema>;
export type Plan = z.infer<typeof PlanSchema>;

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
  return PlanSchema.parse(yaml.load(source));
}

export function pickToday(plan: Plan, weekdayIndex: number): PlanDay | null {
  const name = WEEKDAY_NAMES[weekdayIndex];
  return plan.days[name] ?? null;
}

export function daysSinceWeekStart(plan: Plan): number {
  const start = new Date(plan.week_start + "T00:00:00Z");
  const now = new Date();
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}
