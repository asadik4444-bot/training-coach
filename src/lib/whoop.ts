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

export type RecoveryFetchResult =
  | { status: "scored"; score: number }
  | { status: "pending" }
  | { status: "unscorable" }
  | { status: "no_record" };

// ── Full biometric snapshot ─────────────────────────────────────────────────

export interface BiometricSnapshot {
  date: string; // ISO YYYY-MM-DD (Europe/Zurich today)
  recovery: {
    status: "scored" | "pending" | "unscorable" | "no_record";
    score?: number; // 0-100
    hrv_rmssd_ms?: number; // milliseconds
    rhr_bpm?: number;
  };
  sleep?: {
    efficiency_pct: number; // 0-100
    consistency_pct: number;
    performance_pct: number;
    total_in_bed_min: number;
    total_awake_min: number;
    total_light_min: number;
    total_sws_min: number; // slow-wave / deep
    total_rem_min: number;
    respiratory_rate: number;
  };
  cycle?: {
    strain: number; // 0-21
    kilojoules: number;
    avg_hr: number;
    max_hr: number;
  };
  last_workout?: {
    sport: string;
    strain: number;
    avg_hr: number;
    max_hr: number;
    zone_minutes: {
      z0: number;
      z1: number;
      z2: number;
      z3: number;
      z4: number;
      z5: number;
    };
    distance_meters?: number;
    start: string; // ISO timestamp
  };
}

export async function fetchLatestRecovery(
  accessToken: string,
): Promise<RecoveryFetchResult> {
  const res = await fetch(`${WHOOP_API}/recovery?limit=1`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Whoop recovery fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    records?: Array<{
      score_state?: string;
      score?: { recovery_score?: number };
    }>;
  };
  const records = data.records ?? [];
  if (records.length === 0) return { status: "no_record" };
  const rec = records[0];
  const state = rec.score_state;
  if (state === "SCORED" && typeof rec.score?.recovery_score === "number") {
    return { status: "scored", score: Math.round(rec.score.recovery_score) };
  }
  if (state === "UNSCORABLE") return { status: "unscorable" };
  return { status: "pending" };
}

// ── fetchTodaysBiometrics ────────────────────────────────────────────────────

function authHeaders(accessToken: string): Record<string, string> {
  return { authorization: `Bearer ${accessToken}` };
}

function msToMin(ms: number): number {
  return Math.round(ms / 60000);
}

// ── fetchHistorical ──────────────────────────────────────────────────────────

type WhoopRecoveryRecord = {
  cycle_id?: number;
  score_state?: string;
  score?: {
    recovery_score?: number;
    hrv_rmssd_milli?: number;
    resting_heart_rate?: number;
  };
};

type WhoopCycleRecord = {
  id?: number;
  start?: string;
  score_state?: string;
  score?: {
    strain?: number;
    kilojoule?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
  };
};

type WhoopSleepRecord = {
  cycle_id?: number;
  score_state?: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_awake_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
    sleep_efficiency_percentage?: number;
    sleep_consistency_percentage?: number;
    sleep_performance_percentage?: number;
    respiratory_rate?: number;
  };
};

type WhoopWorkoutRecord = {
  start?: string;
  sport_name?: string;
  score_state?: string;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    distance_meter?: number;
    zone_duration?: {
      zone_zero_milli?: number;
      zone_one_milli?: number;
      zone_two_milli?: number;
      zone_three_milli?: number;
      zone_four_milli?: number;
      zone_five_milli?: number;
    };
  };
};

async function fetchAllPages<T>(
  accessToken: string,
  path: string,
  startISO: string,
  endISO: string,
): Promise<T[]> {
  const headers = authHeaders(accessToken);
  const results: T[] = [];
  let nextToken: string | undefined;

  do {
    const params = new URLSearchParams({
      start: `${startISO}T00:00:00.000Z`,
      end: `${endISO}T23:59:59.999Z`,
      limit: "25",
    });
    if (nextToken) params.set("nextToken", nextToken);
    const url = `${WHOOP_API}${path}?${params.toString()}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Whoop ${path} ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = (await res.json()) as { records?: T[]; next_token?: string };
    const records = data.records ?? [];
    results.push(...records);
    nextToken = data.next_token;
  } while (nextToken);

  return results;
}

/**
 * Fetch up to 90 days of historical biometric snapshots from Whoop API v2.
 * Groups records by Europe/Zurich date and merges recovery + cycle + sleep +
 * most-recent workout into one BiometricSnapshot per day.
 * Returns sorted ascending by date.
 */
export async function fetchHistorical(
  accessToken: string,
  startISO: string,
  endISO: string,
): Promise<BiometricSnapshot[]> {
  // Parallel fetch across all four endpoints (sequential pagination per endpoint)
  const [recoveries, cycles, sleeps, workouts] = await Promise.all([
    fetchAllPages<WhoopRecoveryRecord>(
      accessToken,
      "/recovery",
      startISO,
      endISO,
    ),
    fetchAllPages<WhoopCycleRecord>(accessToken, "/cycle", startISO, endISO),
    fetchAllPages<WhoopSleepRecord>(
      accessToken,
      "/activity/sleep",
      startISO,
      endISO,
    ),
    fetchAllPages<WhoopWorkoutRecord>(
      accessToken,
      "/activity/workout",
      startISO,
      endISO,
    ),
  ]);

  // Helper: convert a UTC-ish ISO timestamp to Europe/Zurich date string
  function toZurichDate(isoTs: string): string {
    const d = new Date(isoTs);
    return d.toLocaleDateString("en-CA", { timeZone: "Europe/Zurich" }); // YYYY-MM-DD
  }

  // Build per-date maps
  const byDate = new Map<string, Partial<BiometricSnapshot>>();

  function getOrCreate(date: string): Partial<BiometricSnapshot> {
    if (!byDate.has(date))
      byDate.set(date, { date, recovery: { status: "no_record" } });
    return byDate.get(date)!;
  }

  // Cycles drive the date key (each cycle has a start timestamp)
  for (const c of cycles) {
    if (!c.start) continue;
    const date = toZurichDate(c.start);
    const snap = getOrCreate(date);
    if (c.score_state === "SCORED" && c.score) {
      snap.cycle = {
        strain: c.score.strain ?? 0,
        kilojoules: c.score.kilojoule ?? 0,
        avg_hr: c.score.average_heart_rate ?? 0,
        max_hr: c.score.max_heart_rate ?? 0,
      };
    }
  }

  // Recovery keyed by cycle_id — look up the cycle's date
  const cycleIdToDate = new Map<number, string>();
  for (const c of cycles) {
    if (c.id != null && c.start) {
      cycleIdToDate.set(c.id, toZurichDate(c.start));
    }
  }

  for (const r of recoveries) {
    const date = r.cycle_id != null ? cycleIdToDate.get(r.cycle_id) : undefined;
    if (!date) continue;
    const snap = getOrCreate(date);
    if (r.score_state === "SCORED" && r.score) {
      snap.recovery = {
        status: "scored",
        score:
          typeof r.score.recovery_score === "number"
            ? Math.round(r.score.recovery_score)
            : undefined,
        hrv_rmssd_ms:
          typeof r.score.hrv_rmssd_milli === "number"
            ? r.score.hrv_rmssd_milli
            : undefined,
        rhr_bpm:
          typeof r.score.resting_heart_rate === "number"
            ? Math.round(r.score.resting_heart_rate)
            : undefined,
      };
    } else if (r.score_state === "UNSCORABLE") {
      snap.recovery = { status: "unscorable" };
    } else {
      snap.recovery = { status: "pending" };
    }
  }

  // Sleep also keyed by cycle_id
  for (const s of sleeps) {
    const date = s.cycle_id != null ? cycleIdToDate.get(s.cycle_id) : undefined;
    if (!date) continue;
    const snap = getOrCreate(date);
    if (s.score_state === "SCORED" && s.score) {
      const st = s.score.stage_summary ?? {};
      snap.sleep = {
        efficiency_pct: s.score.sleep_efficiency_percentage ?? 0,
        consistency_pct: s.score.sleep_consistency_percentage ?? 0,
        performance_pct: s.score.sleep_performance_percentage ?? 0,
        total_in_bed_min: msToMin(st.total_in_bed_time_milli ?? 0),
        total_awake_min: msToMin(st.total_awake_time_milli ?? 0),
        total_light_min: msToMin(st.total_light_sleep_time_milli ?? 0),
        total_sws_min: msToMin(st.total_slow_wave_sleep_time_milli ?? 0),
        total_rem_min: msToMin(st.total_rem_sleep_time_milli ?? 0),
        respiratory_rate: s.score.respiratory_rate ?? 0,
      };
    }
  }

  // Workouts keyed by their start timestamp date (most recent per day wins)
  for (const w of workouts) {
    if (!w.start) continue;
    const date = toZurichDate(w.start);
    const snap = getOrCreate(date);
    if (w.score_state === "SCORED" && w.score) {
      const zd = w.score.zone_duration ?? {};
      const workout: BiometricSnapshot["last_workout"] = {
        sport: w.sport_name ?? "Unknown",
        strain: w.score.strain ?? 0,
        avg_hr: w.score.average_heart_rate ?? 0,
        max_hr: w.score.max_heart_rate ?? 0,
        zone_minutes: {
          z0: msToMin(zd.zone_zero_milli ?? 0),
          z1: msToMin(zd.zone_one_milli ?? 0),
          z2: msToMin(zd.zone_two_milli ?? 0),
          z3: msToMin(zd.zone_three_milli ?? 0),
          z4: msToMin(zd.zone_four_milli ?? 0),
          z5: msToMin(zd.zone_five_milli ?? 0),
        },
        distance_meters:
          typeof w.score.distance_meter === "number"
            ? w.score.distance_meter
            : undefined,
        start: w.start,
      };
      // Most recent workout wins — overwrite if this one is later
      const existing = snap.last_workout;
      if (!existing || w.start > existing.start) {
        snap.last_workout = workout;
      }
    }
  }

  // Sort ascending and cast to full BiometricSnapshot
  return Array.from(byDate.values())
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((s) => s as BiometricSnapshot);
}

export async function fetchTodaysBiometrics(
  accessToken: string,
): Promise<BiometricSnapshot> {
  // Europe/Zurich today date
  const todayDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
  );
  const date = todayDate.toISOString().slice(0, 10);

  const headers = authHeaders(accessToken);

  // Parallel best-effort fetches — individual failures yield undefined
  const [recoveryRaw, cycleRaw, sleepRaw, workoutRaw] = await Promise.all([
    fetch(`${WHOOP_API}/recovery?limit=1`, { headers }).catch(() => undefined),
    fetch(`${WHOOP_API}/cycle?limit=1`, { headers }).catch(() => undefined),
    fetch(`${WHOOP_API}/activity/sleep?limit=1`, { headers }).catch(
      () => undefined,
    ),
    fetch(`${WHOOP_API}/activity/workout?limit=1`, { headers }).catch(
      () => undefined,
    ),
  ]);

  // ── Recovery ──────────────────────────────────────────────────────────────
  let recoveryField: BiometricSnapshot["recovery"] = { status: "no_record" };
  if (recoveryRaw && recoveryRaw.ok) {
    const d = (await recoveryRaw.json().catch(() => null)) as {
      records?: Array<{
        score_state?: string;
        score?: {
          recovery_score?: number;
          hrv_rmssd_milli?: number;
          resting_heart_rate?: number;
        };
      }>;
    } | null;
    const recs = d?.records ?? [];
    if (recs.length > 0) {
      const r = recs[0];
      const state = r.score_state;
      if (state === "SCORED" && r.score) {
        recoveryField = {
          status: "scored",
          score:
            typeof r.score.recovery_score === "number"
              ? Math.round(r.score.recovery_score)
              : undefined,
          hrv_rmssd_ms:
            typeof r.score.hrv_rmssd_milli === "number"
              ? r.score.hrv_rmssd_milli
              : undefined,
          rhr_bpm:
            typeof r.score.resting_heart_rate === "number"
              ? Math.round(r.score.resting_heart_rate)
              : undefined,
        };
      } else if (state === "UNSCORABLE") {
        recoveryField = { status: "unscorable" };
      } else {
        recoveryField = { status: "pending" };
      }
    }
  }

  // ── Cycle ─────────────────────────────────────────────────────────────────
  let cycleField: BiometricSnapshot["cycle"] | undefined;
  if (cycleRaw && cycleRaw.ok) {
    const d = (await cycleRaw.json().catch(() => null)) as {
      records?: Array<{
        score_state?: string;
        score?: {
          strain?: number;
          kilojoule?: number;
          average_heart_rate?: number;
          max_heart_rate?: number;
        };
      }>;
    } | null;
    const recs = d?.records ?? [];
    if (recs.length > 0) {
      const c = recs[0];
      if (c.score_state === "SCORED" && c.score) {
        cycleField = {
          strain: c.score.strain ?? 0,
          kilojoules: c.score.kilojoule ?? 0,
          avg_hr: c.score.average_heart_rate ?? 0,
          max_hr: c.score.max_heart_rate ?? 0,
        };
      }
    }
  }

  // ── Sleep ─────────────────────────────────────────────────────────────────
  let sleepField: BiometricSnapshot["sleep"] | undefined;
  if (sleepRaw && sleepRaw.ok) {
    const d = (await sleepRaw.json().catch(() => null)) as {
      records?: Array<{
        score_state?: string;
        score?: {
          stage_summary?: {
            total_in_bed_time_milli?: number;
            total_awake_time_milli?: number;
            total_light_sleep_time_milli?: number;
            total_slow_wave_sleep_time_milli?: number;
            total_rem_sleep_time_milli?: number;
          };
          sleep_efficiency_percentage?: number;
          sleep_consistency_percentage?: number;
          sleep_performance_percentage?: number;
          respiratory_rate?: number;
        };
      }>;
    } | null;
    const recs = d?.records ?? [];
    if (recs.length > 0) {
      const s = recs[0];
      if (s.score_state === "SCORED" && s.score) {
        const st = s.score.stage_summary ?? {};
        sleepField = {
          efficiency_pct: s.score.sleep_efficiency_percentage ?? 0,
          consistency_pct: s.score.sleep_consistency_percentage ?? 0,
          performance_pct: s.score.sleep_performance_percentage ?? 0,
          total_in_bed_min: msToMin(st.total_in_bed_time_milli ?? 0),
          total_awake_min: msToMin(st.total_awake_time_milli ?? 0),
          total_light_min: msToMin(st.total_light_sleep_time_milli ?? 0),
          total_sws_min: msToMin(st.total_slow_wave_sleep_time_milli ?? 0),
          total_rem_min: msToMin(st.total_rem_sleep_time_milli ?? 0),
          respiratory_rate: s.score.respiratory_rate ?? 0,
        };
      }
    }
  }

  // ── Last workout ──────────────────────────────────────────────────────────
  let workoutField: BiometricSnapshot["last_workout"] | undefined;
  if (workoutRaw && workoutRaw.ok) {
    const d = (await workoutRaw.json().catch(() => null)) as {
      records?: Array<{
        sport_name?: string;
        start?: string;
        score_state?: string;
        score?: {
          strain?: number;
          average_heart_rate?: number;
          max_heart_rate?: number;
          distance_meter?: number;
          zone_duration?: {
            zone_zero_milli?: number;
            zone_one_milli?: number;
            zone_two_milli?: number;
            zone_three_milli?: number;
            zone_four_milli?: number;
            zone_five_milli?: number;
          };
        };
      }>;
    } | null;
    const recs = d?.records ?? [];
    if (recs.length > 0) {
      const w = recs[0];
      if (w.score_state === "SCORED" && w.score) {
        const zd = w.score.zone_duration ?? {};
        workoutField = {
          sport: w.sport_name ?? "Unknown",
          strain: w.score.strain ?? 0,
          avg_hr: w.score.average_heart_rate ?? 0,
          max_hr: w.score.max_heart_rate ?? 0,
          zone_minutes: {
            z0: msToMin(zd.zone_zero_milli ?? 0),
            z1: msToMin(zd.zone_one_milli ?? 0),
            z2: msToMin(zd.zone_two_milli ?? 0),
            z3: msToMin(zd.zone_three_milli ?? 0),
            z4: msToMin(zd.zone_four_milli ?? 0),
            z5: msToMin(zd.zone_five_milli ?? 0),
          },
          distance_meters:
            typeof w.score.distance_meter === "number"
              ? w.score.distance_meter
              : undefined,
          start: w.start ?? "",
        };
      }
    }
  }

  return {
    date,
    recovery: recoveryField,
    sleep: sleepField,
    cycle: cycleField,
    last_workout: workoutField,
  };
}
