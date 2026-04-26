import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/dashboard?key=SECRET
 *
 * Validates the key, sets an HttpOnly signed-cookie session, and redirects to
 * the dashboard root. This is the only place cookies are written — Server
 * Components cannot set cookies in Next.js 15, so we use a Route Handler.
 */

async function signedToken(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode("ok"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET(req: NextRequest) {
  const expected = process.env.DASHBOARD_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "DASHBOARD_SECRET not configured" },
      { status: 500 },
    );
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key || key !== expected) {
    return NextResponse.redirect(new URL("/?auth=fail", req.url));
  }

  const token = await signedToken(expected);
  const cookieStore = await cookies();
  cookieStore.set("tc_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 30 * 24 * 3600,
    path: "/",
  });

  return NextResponse.redirect(new URL("/", req.url));
}
