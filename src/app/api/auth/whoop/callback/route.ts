import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/whoop";
import { saveRefreshToken } from "@/lib/kv";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code)
    return NextResponse.json({ error: "missing code" }, { status: 400 });

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveRefreshToken(tokens.refresh_token);
    return NextResponse.json({
      ok: true,
      message: "Whoop connected. You can close this tab.",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
