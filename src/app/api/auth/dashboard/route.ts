import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/dashboard?key=SECRET
 *
 * Validates the key, sets an HttpOnly signed-cookie session, and redirects to
 * the dashboard root. This is the only place cookies are written — Server
 * Components cannot set cookies in Next.js 15, so we use a Route Handler.
 *
 * Token format: `${expiryUnix}:ok` — HMAC-signed with DASHBOARD_SECRET.
 * The signed payload includes a 30-day expiry so stale tokens are rejected.
 */

export const COOKIE_MAX_AGE = 30 * 24 * 3600; // 30 days in seconds

export async function buildSignedToken(
  secret: string,
  expiryUnix?: number,
): Promise<string> {
  const expiry = expiryUnix ?? Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE;
  const payload = `${expiry}:ok`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${expiry}:${sigHex}`;
}

export async function verifyToken(
  token: string,
  secret: string,
): Promise<boolean> {
  const parts = token.split(":");
  if (parts.length !== 2) return false;
  const [expiryStr, sigHex] = parts;
  const expiry = Number(expiryStr);
  if (isNaN(expiry) || Math.floor(Date.now() / 1000) > expiry) return false;

  const payload = `${expiry}:ok`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(payload));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === sigHex;
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

  const token = await buildSignedToken(expected);
  const cookieStore = await cookies();
  cookieStore.set("tc_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return NextResponse.redirect(new URL("/", req.url));
}
