import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday, daysSinceWeekStart } from "@/lib/plan";
import {
  refreshAccessToken,
  fetchLatestRecovery,
  fetchTodaysBiometrics,
} from "@/lib/whoop";
import { composeMessage } from "@/lib/message";
import { sendTelegram } from "@/lib/telegram";
import {
  isSkipped,
  getSwap,
  setRecoverySnapshot,
  setBiometricSnapshot,
} from "@/lib/kv";

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

    // Persist full biometric snapshot — best-effort, don't break main flow
    try {
      const snapshot = await fetchTodaysBiometrics(accessToken);
      await setBiometricSnapshot(todayISO, snapshot);
    } catch {
      // snapshot persistence is non-critical; continue
    }

    const recovery = await fetchLatestRecovery(accessToken);

    let text: string;
    if (recovery.status === "scored") {
      await setRecoverySnapshot(todayISO, recovery.score);
      text = composeMessage(recovery.score, todayPlan);
    } else if (recovery.status === "pending") {
      text = `Recovery still computing on Whoop's side. I'll send today's plan once it's ready (try /api/cron/daily later).`;
    } else if (recovery.status === "unscorable") {
      text = `Whoop reports unscorable recovery (likely a sensor issue overnight). Default to Z2 + mobility today.`;
    } else {
      text = `No Whoop recovery record yet today. Default to a moderate session if you feel good.`;
    }
    const stale = daysSinceWeekStart(plan) >= 14;
    const finalText = stale
      ? `⚠️ plan.yml is 14+ days old — run Sunday ritual.\n${text}`
      : text;
    await sendTelegram(finalText);

    return NextResponse.json({
      ok: true,
      recoveryStatus: recovery.status,
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
