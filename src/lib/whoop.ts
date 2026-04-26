import { saveRefreshToken, loadRefreshToken } from "./kv";

const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
const WHOOP_API = "https://api.prod.whoop.com/developer/v2";

const SCOPES = "read:recovery read:cycles read:sleep read:workout offline";

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeCodeForTokens(
  code: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    redirect_uri: process.env.WHOOP_REDIRECT_URI!,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok)
    throw new Error(
      `Whoop token exchange failed: ${res.status} ${await res.text()}`,
    );
  return (await res.json()) as TokenResponse;
}

export async function refreshAccessToken(): Promise<string> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken)
    throw new Error(
      "No Whoop refresh token in KV — run /api/auth/whoop/start first",
    );
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: process.env.WHOOP_CLIENT_ID!,
    client_secret: process.env.WHOOP_CLIENT_SECRET!,
    scope: SCOPES,
  });
  const res = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok)
    throw new Error(`Whoop refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as TokenResponse;
  // Whoop returns a new refresh_token each time; persist it
  await saveRefreshToken(data.refresh_token);
  return data.access_token;
}

export async function fetchLatestRecovery(
  accessToken: string,
): Promise<number> {
  const res = await fetch(`${WHOOP_API}/recovery?limit=1`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok)
    throw new Error(
      `Whoop recovery fetch failed: ${res.status} ${await res.text()}`,
    );
  const data = (await res.json()) as {
    records?: Array<{ score?: { recovery_score?: number } }>;
  };
  const records = data.records ?? [];
  if (records.length === 0)
    throw new Error("No recovery records returned by Whoop");
  const score = records[0].score?.recovery_score;
  if (score == null) {
    throw new Error(
      "Whoop recovery score not yet available — retry after sync",
    );
  }
  return Math.round(score);
}
