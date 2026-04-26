import { kv } from "@vercel/kv";

const KEY = "whoop:refresh_token";

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await kv.set(KEY, refreshToken);
}

export async function loadRefreshToken(): Promise<string | null> {
  return await kv.get<string>(KEY);
}
