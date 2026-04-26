import { NextRequest, NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const expected = process.env.WHOOP_SETUP_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "WHOOP_SETUP_SECRET not configured" },
      { status: 500 },
    );
  }
  const got = req.nextUrl.searchParams.get("secret");
  if (got !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = crypto.randomUUID();
  return NextResponse.redirect(buildAuthUrl(state));
}
