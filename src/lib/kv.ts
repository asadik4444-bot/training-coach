import { createClient } from "redis";

const KEY = "whoop:refresh_token";
const SIXTY_DAYS_SECONDS = 60 * 24 * 3600; // 5184000

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

// ── daily log (Redis list) ───────────────────────────────────────────────────

export async function appendDailyLog(
  date: string,
  entry: string,
): Promise<void> {
  const key = `log:${date}`;
  await withClient(async (c) => {
    await c.rPush(key, entry);
    await c.expire(key, SIXTY_DAYS_SECONDS);
  });
}

export async function getDailyLog(date: string): Promise<string[]> {
  const key = `log:${date}`;
  return await withClient((c) => c.lRange(key, 0, -1));
}

// ── skip flag ────────────────────────────────────────────────────────────────

export async function setSkipped(date: string): Promise<void> {
  const key = `skipped:${date}`;
  await withClient((c) => c.set(key, "1", { EX: SIXTY_DAYS_SECONDS }));
}

export async function isSkipped(date: string): Promise<boolean> {
  const key = `skipped:${date}`;
  const val = await withClient((c) => c.get(key));
  return val === "1";
}

// ── swap ─────────────────────────────────────────────────────────────────────

export async function setSwap(date: string, swapToDay: string): Promise<void> {
  const key = `swap:${date}`;
  await withClient((c) => c.set(key, swapToDay, { EX: SIXTY_DAYS_SECONDS }));
}

export async function getSwap(date: string): Promise<string | null> {
  const key = `swap:${date}`;
  return await withClient((c) => c.get(key));
}
