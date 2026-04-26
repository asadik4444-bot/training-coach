import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/api/auth/dashboard/route";
import {
  getBiometricSnapshot,
  getDoneEntry,
  getPainEntries,
  getProtein,
  getBedtime,
  getDailyLog,
} from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
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

  const { date } = await params;

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid date" }, { status: 400 });
  }

  // Fetch all day data in parallel
  const [snap, done, pain, protein, bedtime, log] = await Promise.all([
    getBiometricSnapshot(date),
    getDoneEntry(date),
    getPainEntries(date),
    getProtein(date),
    getBedtime(date),
    getDailyLog(date),
  ]);

  return NextResponse.json({
    date,
    biometrics: snap,
    done,
    pain,
    protein,
    bedtime,
    log,
  });
}
