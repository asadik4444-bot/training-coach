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

// ── biometric snapshot ────────────────────────────────────────────────────────

const NINETY_DAYS_SECONDS = 90 * 24 * 3600;

export async function setBiometricSnapshot(
  date: string,
  snapshot: object,
): Promise<void> {
  const key = `biometrics:${date}`;
  await withClient((c) =>
    c.set(key, JSON.stringify(snapshot), { EX: NINETY_DAYS_SECONDS }),
  );
}

/**
 * Write multiple snapshots in a single Redis connection (avoids 90× connect/quit
 * overhead during backfill). Each key gets a 90-day TTL.
 */
export async function setBiometricSnapshotsBatch(
  entries: Array<{ date: string; snapshot: object }>,
): Promise<void> {
  if (entries.length === 0) return;
  await withClient(async (c) => {
    for (const { date, snapshot } of entries) {
      await c.set(`biometrics:${date}`, JSON.stringify(snapshot), {
        EX: NINETY_DAYS_SECONDS,
      });
    }
  });
}

export async function getBiometricSnapshot(
  date: string,
): Promise<unknown | null> {
  const key = `biometrics:${date}`;
  const v = await withClient((c) => c.get(key));
  return v == null ? null : JSON.parse(v);
}

export async function listBiometricSnapshots(
  daysBack: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const snap = await getBiometricSnapshot(date);
    if (snap) out.push(snap);
  }
  return out;
}

// ── body measurements ────────────────────────────────────────────────────────

const ONE_YEAR_SECONDS = 365 * 24 * 3600;

export async function setBodyMeasurement(
  date: string,
  field: "weight" | "waist",
  value: number,
): Promise<void> {
  const key = `body:${field}:${date}`;
  await withClient((c) => c.set(key, String(value), { EX: ONE_YEAR_SECONDS }));
}

export async function getBodyMeasurement(
  date: string,
  field: "weight" | "waist",
): Promise<number | null> {
  const key = `body:${field}:${date}`;
  const v = await withClient((c) => c.get(key));
  return v == null ? null : Number(v);
}

export async function listBodyMeasurements(
  field: "weight" | "waist",
  daysBack: number,
): Promise<Array<{ date: string; value: number }>> {
  const out: Array<{ date: string; value: number }> = [];
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const date = d.toISOString().slice(0, 10);
    const v = await getBodyMeasurement(date, field);
    if (v != null) out.push({ date, value: v });
  }
  return out;
}

// ── recovery snapshot ────────────────────────────────────────────────────────

export async function setRecoverySnapshot(
  date: string,
  score: number,
): Promise<void> {
  const key = `recovery:${date}`;
  await withClient((c) =>
    c.set(key, String(score), { EX: SIXTY_DAYS_SECONDS }),
  );
}

export async function getRecoverySnapshot(
  date: string,
): Promise<number | null> {
  const key = `recovery:${date}`;
  const v = await withClient((c) => c.get(key));
  return v == null ? null : Number(v);
}
