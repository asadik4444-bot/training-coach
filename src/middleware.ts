import { NextRequest, NextResponse } from "next/server";
import {
  buildSignedToken,
  verifyToken,
  COOKIE_MAX_AGE,
} from "@/app/api/auth/dashboard/route";

/**
 * Middleware — auto-renews the tc_session cookie when it is valid but
 * will expire in fewer than 7 days (i.e., more than 23 days old).
 *
 * Cookie setting is NOT possible in Server Components — this middleware
 * runs on every request before the Server Component and is the correct
 * place to handle transparent renewal.
 */

const RENEW_THRESHOLD_SECS = 7 * 24 * 3600; // renew when < 7 days remain

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  const secret = process.env.DASHBOARD_SECRET;
  if (!secret) return res;

  const token = req.cookies.get("tc_session")?.value;
  if (!token) return res;

  // Parse expiry from token (format: "${expiryUnix}:${sigHex}")
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return res;
  const expiry = Number(token.slice(0, colonIdx));
  if (isNaN(expiry)) return res;

  const nowSecs = Math.floor(Date.now() / 1000);
  const remaining = expiry - nowSecs;

  // Reject expired tokens outright — page.tsx will handle 401
  if (remaining <= 0) return res;

  // Auto-renew if fewer than 7 days remain
  if (remaining < RENEW_THRESHOLD_SECS) {
    const isValid = await verifyToken(token, secret);
    if (isValid) {
      const newToken = await buildSignedToken(secret);
      res.cookies.set("tc_session", newToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      });
    }
  }

  return res;
}

export const config = {
  // Only run on the dashboard root — skip API routes and static assets
  matcher: ["/", "/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
