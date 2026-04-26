import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/auth/dashboard/route";
import { listBiometricSnapshots } from "@/lib/kv";
import type { BiometricSnapshot } from "@/lib/whoop";

export const dynamic = "force-dynamic";

type Metric = "hrv" | "rhr" | "sleep" | "strain";

function extractValue(snap: BiometricSnapshot, metric: Metric): number | null {
  switch (metric) {
    case "hrv":
      return snap.recovery?.hrv_rmssd_ms ?? null;
    case "rhr":
      return snap.recovery?.rhr_bpm ?? null;
    case "sleep":
      return snap.sleep?.efficiency_pct ?? null;
    case "strain":
      return snap.cycle?.strain ?? null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ metric: string }> },
) {
  // Auth check
  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("tc_session")?.value;
  if (!token || !(await verifyToken(token, secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { metric } = await params;
  const validMetrics: Metric[] = ["hrv", "rhr", "sleep", "strain"];
  if (!validMetrics.includes(metric as Metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
  }

  const daysParam = req.nextUrl.searchParams.get("days");
  const days = Math.min(365, Math.max(1, Number(daysParam) || 365));

  const snaps = (await listBiometricSnapshots(days)) as BiometricSnapshot[];

  const points = snaps
    .map((s) => {
      const value = extractValue(s, metric as Metric);
      return value != null ? { date: s.date, value } : null;
    })
    .filter((p): p is { date: string; value: number } => p != null);

  return NextResponse.json({ metric, days, points });
}
