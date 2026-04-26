import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday } from "@/lib/plan";
import { refreshAccessToken, fetchLatestRecovery } from "@/lib/whoop";
import { composeMessage } from "@/lib/message";
import { sendTelegram } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization");
    if (got !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));

    const todayDate = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
    );
    const weekday = todayDate.getDay();
    const todayPlan = pickToday(plan, weekday);

    const accessToken = await refreshAccessToken();
    const recoveryPct = await fetchLatestRecovery(accessToken);

    const text = composeMessage(recoveryPct, todayPlan);
    await sendTelegram(text);

    return NextResponse.json({ ok: true, recoveryPct, sent: text });
  } catch (e) {
    const msg = String(e);
    try {
      await sendTelegram(`⚠️ training-coach cron error: ${msg.slice(0, 300)}`);
    } catch {}
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
