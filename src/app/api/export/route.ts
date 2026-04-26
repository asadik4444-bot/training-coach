import { NextRequest, NextResponse } from "next/server";
import { getArchiveMonth, listArchiveMonths } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.DASHBOARD_SECRET;
  if (!expected || key !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const months = await listArchiveMonths();
    const all: unknown[] = [];
    for (const month of months) {
      const entries = await getArchiveMonth(month);
      all.push(...entries);
    }
    return NextResponse.json({
      ok: true,
      months,
      count: all.length,
      entries: all,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
