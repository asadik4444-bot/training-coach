import { createClient } from "redis";

const KEY = "whoop:refresh_token";

async function withClient<T>(
  fn: (c: ReturnType<typeof createClient>) => Promise<T>,
): Promise<T> {
  const url = process.env.KV_REDIS_URL;
  if (!url) throw new Error("KV_REDIS_URL not set");
  const client = createClient({ url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.quit();
  }
}

export async function saveRefreshToken(refreshToken: string): Promise<void> {
  await withClient((c) => c.set(KEY, refreshToken));
}

export async function loadRefreshToken(): Promise<string | null> {
  return await withClient((c) => c.get(KEY));
}
