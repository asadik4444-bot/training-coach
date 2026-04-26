import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/whoop";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = crypto.randomUUID();
  return NextResponse.redirect(buildAuthUrl(state));
}
