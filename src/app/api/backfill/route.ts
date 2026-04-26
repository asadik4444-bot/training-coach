import { NextRequest, NextResponse } from "next/server";
import { refreshAccessToken, fetchHistorical } from "@/lib/whoop";
import { setBiometricSnapshotsBatch } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected)
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const days = Number(req.nextUrl.searchParams.get("days") ?? 90);
  const end = new Date();
  const start = new Date();
  start.setUTCDate(end.getUTCDate() - days);
  const startISO = start.toISOString().slice(0, 10);
  const endISO = end.toISOString().slice(0, 10);

  const accessToken = await refreshAccessToken();
  const snapshots = await fetchHistorical(accessToken, startISO, endISO);

  // Batch write — single Redis connection instead of 90× connect/quit cycles
  await setBiometricSnapshotsBatch(
    snapshots.map((snap) => ({ date: snap.date, snapshot: snap })),
  );

  return NextResponse.json({
    ok: true,
    days,
    stored: snapshots.length,
    range: { startISO, endISO },
  });
}
