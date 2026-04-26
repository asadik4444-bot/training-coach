import { createClient, type RedisClientType } from "redis";

const KEY = "whoop:refresh_token";
const SIXTY_DAYS_SECONDS = 60 * 24 * 3600; // 5184000

// ── Singleton Redis client (module-level, lazy connect, reused across calls) ──

let _cached: RedisClientType | null = null;
let _connecting: Promise<RedisClientType> | null = null;

async function getClient(): Promise<RedisClientType> {
  if (_cached?.isOpen) return _cached;
  if (_connecting) return _connecting;
  _connecting = (async () => {
    const url = process.env.KV_REDIS_URL;
    if (!url) throw new Error("KV_REDIS_URL not set");
    const client = createClient({ url }) as RedisClientType;
    // Clear cached reference on any disconnection/error so next call reconnects
    client.on("error", () => {
      _cached = null;
    });
    client.on("end", () => {
      _cached = null;
    });
    client.on("disconnect", () => {
      _cached = null;
    });
    await client.connect();
    _cached = client;
    return client;
  })();
  const c = await _connecting;
  _connecting = null;
  return c;
}

async function withClient<T>(
  fn: (c: RedisClientType) => Promise<T>,
): Promise<T> {
  const c = await getClient();
  return fn(c);
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
  const dates = Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const snaps = await Promise.all(
    dates.map((date) => getBiometricSnapshot(date)),
  );
  return snaps.filter((s) => s != null);
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
  const dates = Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const results = await Promise.all(
    dates.map(async (date) => {
      const v = await getBodyMeasurement(date, field);
      return v != null ? { date, value: v } : null;
    }),
  );
  return results.filter((r): r is { date: string; value: number } => r != null);
}

// ── done entry (RPE / RIR / soreness) ────────────────────────────────────────

export interface DoneEntry {
  date: string;
  rpe?: number;
  rir?: number;
  soreness?: number;
  notes?: string;
  created_at: string;
}

export async function saveDoneEntry(
  date: string,
  entry: Omit<DoneEntry, "date" | "created_at">,
): Promise<void> {
  const key = `done:${date}`;
  const value = JSON.stringify({
    ...entry,
    date,
    created_at: new Date().toISOString(),
  });
  await withClient((c) => c.set(key, value, { EX: 365 * 24 * 3600 }));
}

export async function getDoneEntry(date: string): Promise<DoneEntry | null> {
  const key = `done:${date}`;
  const v = await withClient((c) => c.get(key));
  return v == null ? null : (JSON.parse(v) as DoneEntry);
}

export async function listDoneEntries(daysBack: number): Promise<DoneEntry[]> {
  const dates = Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const results = await Promise.all(dates.map((date) => getDoneEntry(date)));
  return results.filter((e): e is DoneEntry => e != null);
}

// ── goals ─────────────────────────────────────────────────────────────────────

export type GoalField = "weight" | "waist" | "hrv" | "rhr";

export async function setGoal(field: GoalField, value: number): Promise<void> {
  await withClient((c) => c.set(`goal:${field}`, String(value)));
}

export async function getGoal(field: GoalField): Promise<number | null> {
  const v = await withClient((c) => c.get(`goal:${field}`));
  return v == null ? null : Number(v);
}

export async function listAllGoals(): Promise<
  Record<GoalField, number | null>
> {
  const fields: GoalField[] = ["weight", "waist", "hrv", "rhr"];
  const values = await Promise.all(fields.map((f) => getGoal(f)));
  return Object.fromEntries(fields.map((f, i) => [f, values[i]])) as Record<
    GoalField,
    number | null
  >;
}

// ── protein tracking ─────────────────────────────────────────────────────────

export async function setProtein(date: string, hit: boolean): Promise<void> {
  const key = `protein:${date}`;
  await withClient((c) =>
    c.set(key, hit ? "y" : "n", { EX: ONE_YEAR_SECONDS }),
  );
}

export async function getProtein(date: string): Promise<boolean | null> {
  const key = `protein:${date}`;
  const v = await withClient((c) => c.get(key));
  if (v === "y") return true;
  if (v === "n") return false;
  return null;
}

export async function listProtein(
  daysBack: number,
): Promise<Array<{ date: string; hit: boolean }>> {
  const dates = Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const results = await Promise.all(
    dates.map(async (date) => {
      const v = await getProtein(date);
      return v != null ? { date, hit: v } : null;
    }),
  );
  return results.filter((r): r is { date: string; hit: boolean } => r != null);
}

// ── bedtime tracking ──────────────────────────────────────────────────────────

export async function setBedtime(date: string, time: string): Promise<void> {
  const key = `bedtime:${date}`;
  await withClient((c) => c.set(key, time, { EX: ONE_YEAR_SECONDS }));
}

export async function getBedtime(date: string): Promise<string | null> {
  const key = `bedtime:${date}`;
  return await withClient((c) => c.get(key));
}

export async function listBedtimes(
  daysBack: number,
): Promise<Array<{ date: string; time: string }>> {
  const dates = Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const results = await Promise.all(
    dates.map(async (date) => {
      const t = await getBedtime(date);
      return t != null ? { date, time: t } : null;
    }),
  );
  return results.filter((r): r is { date: string; time: string } => r != null);
}

// ── pain log ──────────────────────────────────────────────────────────────────

export interface PainEntry {
  area: string;
  severity: number;
  note: string;
  ts: string;
}

export async function addPainEntry(
  date: string,
  entry: Omit<PainEntry, "ts">,
): Promise<void> {
  const key = `pain:${date}`;
  await withClient(async (c) => {
    const existing = await c.get(key);
    const arr: PainEntry[] = existing ? JSON.parse(existing) : [];
    arr.push({ ...entry, ts: new Date().toISOString() });
    await c.set(key, JSON.stringify(arr), { EX: ONE_YEAR_SECONDS });
  });
}

export async function getPainEntries(date: string): Promise<PainEntry[]> {
  const key = `pain:${date}`;
  const v = await withClient((c) => c.get(key));
  return v ? JSON.parse(v) : [];
}

export async function listPainEntries(
  daysBack: number,
): Promise<Array<{ date: string; entries: PainEntry[] }>> {
  const dates = Array.from({ length: daysBack }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (daysBack - 1 - i));
    return d.toISOString().slice(0, 10);
  });
  const results = await Promise.all(
    dates.map(async (date) => {
      const entries = await getPainEntries(date);
      return entries.length > 0 ? { date, entries } : null;
    }),
  );
  return results.filter(
    (r): r is { date: string; entries: PainEntry[] } => r != null,
  );
}

// ── durable archive (no TTL) ─────────────────────────────────────────────────

export async function appendToArchive(
  monthKey: string,
  entry: object,
): Promise<void> {
  const key = `archive:${monthKey}`;
  await withClient(async (c) => {
    const existing = await c.get(key);
    const arr = existing ? JSON.parse(existing) : [];
    arr.push(entry);
    await c.set(key, JSON.stringify(arr)); // NO EXPIRY — durable archive
  });
}

export async function getArchiveMonth(monthKey: string): Promise<unknown[]> {
  const key = `archive:${monthKey}`;
  const v = await withClient((c) => c.get(key));
  return v ? JSON.parse(v) : [];
}

export async function listArchiveMonths(): Promise<string[]> {
  return await withClient(async (c) => {
    // Use KEYS for small archive sets (one key per month)
    const keys = await c.keys("archive:*");
    return keys.map((k: string) => k.replace("archive:", "")).sort();
  });
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
