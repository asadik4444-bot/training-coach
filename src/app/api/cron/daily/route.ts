import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday, daysSinceWeekStart } from "@/lib/plan";
import { refreshAccessToken, fetchTodaysBiometrics } from "@/lib/whoop";
import { sendTelegram, sendTelegramWithButtons } from "@/lib/telegram";
import {
  isSkipped,
  getSwap,
  setRecoverySnapshot,
  setBiometricSnapshot,
  listBiometricSnapshots,
  getPainEntries,
  appendToArchive,
} from "@/lib/kv";
import { computeTrends } from "@/lib/trends";
import { computeStreaks } from "@/lib/streak";
import type { BiometricSnapshot } from "@/lib/whoop";
import { decideToday, detectDeloadNeed } from "@/lib/coach";
import { opener, streakCue, adherenceCue, deloadCelebrate } from "@/lib/voice";

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

function getWhoopUpstreamError(
  e: unknown,
): { status: number; body: string } | null {
  if (!(e instanceof Error) || e.message !== "whoop upstream error") {
    return null;
  }
  const maybe = e as Error & { status?: unknown; body?: unknown };
  if (typeof maybe.status !== "number" || typeof maybe.body !== "string") {
    return null;
  }
  return { status: maybe.status, body: maybe.body };
}

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

    // Fetch today's max pain severity for the pain gate
    const painEntries = await getPainEntries(todayISO);
    const maxPainSeverity =
      painEntries.length > 0
        ? Math.max(...painEntries.map((e) => e.severity))
        : undefined;

    // Science-grounded decision (includes pain gate)
    const decision = decideToday(
      snapshot.recovery.status,
      snapshot.recovery.score ?? null,
      snapshot.recovery.hrv_rmssd_ms ?? null,
      trends,
      maxPainSeverity,
    );

    // Deload detection — prepend warning if 2+ chronic overreaching signals
    const deload = detectDeloadNeed(trends);

    // Compute streaks for voice cues
    const skipMap: Record<string, boolean> = {};
    await Promise.all(
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        const date = d.toISOString().slice(0, 10);
        return isSkipped(date).then((v) => {
          skipMap[date] = v;
        });
      }),
    );
    const streaks = computeStreaks(rawSnaps as BiometricSnapshot[], skipMap);

    // Count skips this week (Mon–today)
    const weekStart = new Date(todayDate);
    weekStart.setDate(weekStart.getDate() - ((weekday + 6) % 7)); // Monday
    let skippedThisWeek = 0;
    for (const [date, skipped] of Object.entries(skipMap)) {
      if (skipped && date >= weekStart.toISOString().slice(0, 10)) {
        skippedThisWeek++;
      }
    }

    // Build Telegram message
    const planLine = decision.hard_stop
      ? "Mandatory rest. Z2 walk if you feel restless. Sleep early."
      : todayPlan
        ? `Today: ${todayPlan.summary}`
        : "Rest day.";

    const messageLines: string[] = [];

    // Voice opener
    messageLines.push(opener(decision.band));

    if (deload.triggered) {
      messageLines.push(
        `🛑 DELOAD SIGNAL: ${deload.reasons.join(", ")}`,
        deloadCelebrate(),
      );
    }

    messageLines.push(
      `${decision.emoji} ${decision.reason}`,
      planLine,
      ...decision.flags.map((f) => `⚠️ ${f}`),
    );

    // Streak cue after plan line
    const sc = streakCue(streaks.green_recovery);
    if (sc) messageLines.push(sc);

    // Adherence cue
    const ac = adherenceCue(skippedThisWeek);
    if (ac) messageLines.push(ac);

    const text = messageLines.join("\n");
    const stale = daysSinceWeekStart(plan) >= 14;
    const finalText = stale
      ? `⚠️ plan.yml is 14+ days old — run Sunday ritual.\n${text}`
      : text;

    // Inline keyboard for quick actions
    await sendTelegramWithButtons(finalText, [
      [
        { text: "Confirm plan ✓", callback_data: "confirm" },
        { text: "Skip", callback_data: "skip" },
      ],
      [
        { text: "Swap to Mon", callback_data: "swap:monday" },
        { text: "Swap to Tue", callback_data: "swap:tuesday" },
        { text: "Swap to Wed", callback_data: "swap:wednesday" },
      ],
    ]);

    // Durable archive append (no TTL — escapes 90d Redis TTL)
    const monthKey = todayISO.slice(0, 7); // YYYY-MM
    await appendToArchive(monthKey, {
      date: todayISO,
      snapshot: {
        recovery: snapshot.recovery,
        sleep: snapshot.sleep,
        last_workout: snapshot.last_workout,
      },
      decision: {
        band: decision.band,
        reason: decision.reason,
        hard_stop: decision.hard_stop,
        intensity_multiplier: decision.intensity_multiplier,
      },
    });

    return NextResponse.json({
      ok: true,
      recoveryStatus: snapshot.recovery.status,
      band: decision.band,
      sent: finalText,
    });
  } catch (e) {
    const whoopError = getWhoopUpstreamError(e);
    if (whoopError) {
      const { status, body } = whoopError;
      console.error("whoop upstream error", {
        status,
        bodyPreview: body.slice(0, 500),
      });
      return NextResponse.json(
        { error: "whoop upstream error", status },
        { status: 502 },
      );
    }
    const msg = String(e);
    try {
      await sendTelegram(`⚠️ training-coach cron error: ${msg.slice(0, 300)}`);
    } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
