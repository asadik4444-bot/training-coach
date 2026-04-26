import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday, daysSinceWeekStart } from "@/lib/plan";
import { refreshAccessToken, fetchTodaysBiometrics } from "@/lib/whoop";
import { sendTelegram } from "@/lib/telegram";
import {
  isSkipped,
  getSwap,
  setRecoverySnapshot,
  setBiometricSnapshot,
  listBiometricSnapshots,
} from "@/lib/kv";
import { computeTrends } from "@/lib/trends";
import type { BiometricSnapshot } from "@/lib/whoop";
import { decideToday } from "@/lib/coach";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured on server" },
      { status: 500 },
    );
  }
  const got = req.headers.get("authorization");
  if (got !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));

    const todayDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
    );
    const todayISO = todayDate.toISOString().slice(0, 10);
    const weekday = todayDate.getDay();

    // Check skip before hitting WHOOP API
    if (await isSkipped(todayISO)) {
      await sendTelegram("Skipping today as requested.");
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Check swap: replace today's plan with another day's plan
    const swapTarget = await getSwap(todayISO);
    const effectiveWeekday = swapTarget
      ? WEEKDAY_NAMES.indexOf(swapTarget)
      : weekday;

    let todayPlan = pickToday(plan, effectiveWeekday);

    const accessToken = await refreshAccessToken();

    // Fetch full biometric snapshot for today
    const snapshot = await fetchTodaysBiometrics(accessToken);
    await setBiometricSnapshot(todayISO, snapshot);

    // Persist recovery score for weekly summary
    if (
      snapshot.recovery.status === "scored" &&
      typeof snapshot.recovery.score === "number"
    ) {
      await setRecoverySnapshot(todayISO, snapshot.recovery.score);
    }

    // Compute trends from 28-day biometric history
    const rawSnaps = await listBiometricSnapshots(28);
    const trends = computeTrends(rawSnaps as BiometricSnapshot[]);

    // Science-grounded decision
    const decision = decideToday(
      snapshot.recovery.status,
      snapshot.recovery.score ?? null,
      snapshot.recovery.hrv_rmssd_ms ?? null,
      trends,
    );

    // Build Telegram message
    const planLine = decision.hard_stop
      ? "Mandatory rest. Z2 walk if you feel restless. Sleep early."
      : todayPlan
        ? `Today: ${todayPlan.summary}`
        : "Rest day.";

    const messageLines: string[] = [
      `${decision.emoji} ${decision.reason}`,
      planLine,
      ...decision.flags.map((f) => `⚠️ ${f}`),
    ];

    const text = messageLines.join("\n");
    const stale = daysSinceWeekStart(plan) >= 14;
    const finalText = stale
      ? `⚠️ plan.yml is 14+ days old — run Sunday ritual.\n${text}`
      : text;
    await sendTelegram(finalText);

    return NextResponse.json({
      ok: true,
      recoveryStatus: snapshot.recovery.status,
      band: decision.band,
      sent: finalText,
    });
  } catch (e) {
    const msg = String(e);
    try {
      await sendTelegram(`⚠️ training-coach cron error: ${msg.slice(0, 300)}`);
    } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
