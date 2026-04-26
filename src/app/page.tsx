import {
  listBiometricSnapshots,
  listBodyMeasurements,
  isSkipped,
  listAllGoals,
  listProtein,
  listBedtimes,
} from "@/lib/kv";
import { computeTrends } from "@/lib/trends";
import { computeStreaks } from "@/lib/streak";
import type { BiometricSnapshot } from "@/lib/whoop";
import { polarizedAnalysis, toMetrics } from "@/lib/analytics";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday } from "@/lib/plan";
import { cookies } from "next/headers";
import { opener } from "@/lib/voice";
import { classifyRecovery } from "@/lib/recovery";
import StickyToday from "@/components/StickyToday";
import Heatmap from "@/components/Heatmap";
import TrendChart from "@/components/TrendChart";
import PullToRefresh from "@/components/PullToRefresh";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ key?: string; detail?: string }>;
}

// ── Auth helper (read-only — cookie setting happens in /api/auth/dashboard) ───

async function isAuthorized(
  searchParamsKey: string | undefined,
): Promise<boolean> {
  const expected = process.env.DASHBOARD_SECRET;
  if (!expected) return false;

  // Check cookie first — token format is "${expiryUnix}:${sigHex}"
  const cookieStore = await cookies();
  const session = cookieStore.get("tc_session")?.value;
  if (session) {
    const { verifyToken } = await import("@/app/api/auth/dashboard/route");
    if (await verifyToken(session, expected)) return true;
  }

  // Fall back: accept ?key= directly (user will be redirected to set cookie next time)
  return searchParamsKey === expected;
}

// ── Unauthorised view ─────────────────────────────────────────────────────────

function UnauthorizedView() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      <div style={{ fontSize: "3rem" }}>🔒</div>
      <h1 style={{ margin: 0, fontSize: "1.5rem", color: "var(--text-muted)" }}>
        Access denied
      </h1>
      <p style={{ margin: 0, color: "var(--text-dim)", fontSize: "0.875rem" }}>
        Visit /api/auth/dashboard?key=YOUR_SECRET to authenticate
      </p>
    </div>
  );
}

// ── Progress bar helper ───────────────────────────────────────────────────────

function progressBar(current: number, goal: number, segments = 5): string {
  const ratio = Math.min(1, Math.max(0, current / goal));
  const filled = Math.round(ratio * segments);
  return "▰".repeat(filled) + "▱".repeat(segments - filled);
}

// ── Widget wrapper ────────────────────────────────────────────────────────────

function Widget({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        marginBottom: "0.75rem",
        border: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--text-dim)",
          marginBottom: "0.5rem",
          fontWeight: 600,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Stat row helper ───────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "0.15rem 0",
      }}
    >
      <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
        {label}
      </span>
      <span style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
        <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{value}</span>
        {delta && (
          <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function Page({ searchParams }: Props) {
  const { key, detail } = await searchParams;
  if (!(await isAuthorized(key))) {
    return <UnauthorizedView />;
  }
  const showDetail = detail === "1";

  // ── Data fetching ──────────────────────────────────────────────────────────
  // snaps91 (for heatmap) and goals/protein are always fetched so the heatmap
  // is interactive on the main view without requiring ?detail=1.
  const [
    snaps30,
    snaps60,
    weightHistory,
    waistHistory,
    snaps91,
    goals,
    proteinHistory,
    bedtimes30,
  ] = (await Promise.all([
    listBiometricSnapshots(30),
    listBiometricSnapshots(60),
    listBodyMeasurements("weight", 30),
    listBodyMeasurements("waist", 30),
    listBiometricSnapshots(91),
    listAllGoals(),
    listProtein(7),
    listBedtimes(30),
  ])) as [
    BiometricSnapshot[],
    BiometricSnapshot[],
    Array<{ date: string; value: number }>,
    Array<{ date: string; value: number }>,
    BiometricSnapshot[],
    Awaited<ReturnType<typeof listAllGoals>>,
    Array<{ date: string; hit: boolean }>,
    Array<{ date: string; time: string }>,
  ];

  const trends = computeTrends(snaps30);
  const metrics = toMetrics(snaps30);
  const pa = polarizedAnalysis(metrics);

  // Build skip map for streaks — must query the actual skipped:${date} keys,
  // not infer from biometric snapshots (which are independent).
  const skipMap: Record<string, boolean> = {};
  await Promise.all(
    Array.from({ length: 60 }, (_, i) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const date = d.toISOString().slice(0, 10);
      return isSkipped(date).then((v) => {
        skipMap[date] = v;
      });
    }),
  );
  const streaks = computeStreaks(snaps30, skipMap);

  // Today's snapshot
  const todayDate = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Zurich" }),
  );
  const todayISO = todayDate.toISOString().slice(0, 10);
  const todaySnap = snaps30.find((s) => s.date === todayISO) ?? null;

  // Today's plan
  let todayPlan: string | null = null;
  try {
    const planPath = path.join(process.cwd(), "plan.yml");
    const plan = parsePlan(readFileSync(planPath, "utf-8"));
    const weekday = new Date(todayISO + "T12:00:00Z").getUTCDay();
    const day = pickToday(plan, weekday);
    if (day) todayPlan = `[${day.type}] ${day.summary}`;
  } catch {
    // plan read is non-critical
  }

  // Today's recovery info
  const rec = todaySnap?.recovery;
  const recScore = rec?.status === "scored" ? (rec.score ?? null) : null;
  const recStr = recScore != null ? `${recScore}%` : (rec?.status ?? "—");
  const hrvStr =
    rec?.hrv_rmssd_ms != null ? `${Math.round(rec.hrv_rmssd_ms)}ms` : "—";
  const rhrStr = rec?.rhr_bpm != null ? `${rec.rhr_bpm}bpm` : "—";
  const sleepEffStr =
    todaySnap?.sleep != null
      ? `${Math.round(todaySnap.sleep.efficiency_pct)}%`
      : "—";
  const sleepDurStr = (() => {
    if (!todaySnap?.sleep) return "";
    const h = Math.floor(todaySnap.sleep.total_in_bed_min / 60);
    const m = todaySnap.sleep.total_in_bed_min % 60;
    return ` (${h}h${m}m)`;
  })();

  // Recovery band + color
  const recBand =
    recScore != null ? classifyRecovery(recScore).band : ("red" as const);
  const recColor =
    recScore != null
      ? recScore >= 67
        ? "var(--green)"
        : recScore >= 34
          ? "var(--yellow)"
          : "var(--red)"
      : "var(--text-muted)";

  // Coach voice opener
  const coachOpener = opener(recBand);

  // Recovery emoji for compact sticky strip
  const recEmoji =
    recScore != null
      ? recScore >= 67
        ? "🟢"
        : recScore >= 34
          ? "🟡"
          : "🔴"
      : "⚪";

  // HRV sparkline values
  const hrvValues = snaps30
    .filter((s) => typeof s.recovery.hrv_rmssd_ms === "number")
    .map((s) => s.recovery.hrv_rmssd_ms as number);

  const hrvAvg =
    hrvValues.length > 0
      ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length
      : null;

  const hrvLatest = todaySnap?.recovery.hrv_rmssd_ms ?? null;

  // HRV CV
  let hrvCv: number | null = null;
  if (hrvValues.length >= 2 && hrvAvg && hrvAvg > 0) {
    const variance =
      hrvValues.reduce((acc, v) => acc + (v - hrvAvg) ** 2, 0) /
      (hrvValues.length - 1);
    hrvCv = (Math.sqrt(variance) / hrvAvg) * 100;
  }

  // 91-day heatmap data (13 weeks × 7 days)
  const heatmapScores: Array<{ date: string; score: number | null }> =
    snaps91.map((s) => ({
      date: s.date,
      score:
        s.recovery.status === "scored" && s.recovery.score != null
          ? s.recovery.score
          : null,
    }));

  // 91-day data per metric for TrendChart (server pre-fetched, client slices)
  const hrv91 = snaps91
    .filter((s) => typeof s.recovery.hrv_rmssd_ms === "number")
    .map((s) => ({ date: s.date, value: s.recovery.hrv_rmssd_ms as number }));
  const rhr91 = snaps91
    .filter((s) => typeof s.recovery.rhr_bpm === "number")
    .map((s) => ({ date: s.date, value: s.recovery.rhr_bpm as number }));
  const sleep91 = snaps91
    .filter((s) => s.sleep != null)
    .map((s) => ({ date: s.date, value: s.sleep!.efficiency_pct }));
  const strain91 = snaps91
    .filter((s) => typeof s.cycle?.strain === "number")
    .map((s) => ({ date: s.date, value: s.cycle!.strain as number }));

  // Week-over-week: split snaps30 into this-week (0..6) and last-week (7..13)
  const snapsByDaysAgo = new Map<number, BiometricSnapshot>();
  for (const s of snaps60) {
    const todayMs = new Date(todayISO + "T00:00:00Z").getTime();
    const snapMs = new Date(s.date + "T00:00:00Z").getTime();
    const diff = Math.round((todayMs - snapMs) / (24 * 3600 * 1000));
    if (diff >= 0) snapsByDaysAgo.set(diff, s);
  }

  function weekAvg(
    getter: (s: BiometricSnapshot) => number | null | undefined,
    startDay: number,
    endDay: number,
  ): number | null {
    const vals: number[] = [];
    for (let d = startDay; d <= endDay; d++) {
      const s = snapsByDaysAgo.get(d);
      if (!s) continue;
      const v = getter(s);
      if (typeof v === "number") vals.push(v);
    }
    return vals.length > 0
      ? vals.reduce((a, b) => a + b, 0) / vals.length
      : null;
  }

  const wow = {
    hrv_this: weekAvg((s) => s.recovery.hrv_rmssd_ms, 0, 6),
    hrv_prev: weekAvg((s) => s.recovery.hrv_rmssd_ms, 7, 13),
    rhr_this: weekAvg((s) => s.recovery.rhr_bpm, 0, 6),
    rhr_prev: weekAvg((s) => s.recovery.rhr_bpm, 7, 13),
    sleep_this: weekAvg((s) => s.sleep?.efficiency_pct, 0, 6),
    sleep_prev: weekAvg((s) => s.sleep?.efficiency_pct, 7, 13),
    strain_this: weekAvg((s) => s.cycle?.strain, 0, 6),
    strain_prev: weekAvg((s) => s.cycle?.strain, 7, 13),
  };

  // Goals progress
  const latestHrv = hrvLatest;
  const latestRhr = todaySnap?.recovery.rhr_bpm ?? null;
  const latestWeight =
    weightHistory.length > 0
      ? weightHistory[weightHistory.length - 1].value
      : null;
  const latestWaist =
    waistHistory.length > 0
      ? waistHistory[waistHistory.length - 1].value
      : null;

  // Protein hit rate
  const proteinHits = proteinHistory.filter((p) => p.hit).length;
  const proteinRate =
    proteinHistory.length > 0
      ? Math.round((proteinHits / proteinHistory.length) * 100)
      : null;

  // Bedtime consistency
  // Bedtimes stored as "HH:MM" strings — convert to minutes-since-midnight
  // treating post-midnight (00:xx–03:xx) as 24h+ so the mean is sensible
  function bedtimeToMinutes(t: string): number {
    const [h, m] = t.split(":").map(Number);
    const mins = (h ?? 0) * 60 + (m ?? 0);
    // Treat early morning (before 4 AM) as after midnight (>1440)
    return mins < 240 ? mins + 1440 : mins;
  }
  function minutesToHHMM(mins: number): string {
    const normalized = mins % 1440;
    const h = Math.floor(normalized / 60);
    const m = Math.round(normalized % 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const bedtimeMins = bedtimes30.map((b) => bedtimeToMinutes(b.time));
  const bedtimeAvgMin =
    bedtimeMins.length > 0
      ? bedtimeMins.reduce((a, b) => a + b, 0) / bedtimeMins.length
      : null;
  let bedtimeStdev: number | null = null;
  if (bedtimeMins.length >= 2 && bedtimeAvgMin != null) {
    const variance =
      bedtimeMins.reduce((acc, v) => acc + (v - bedtimeAvgMin) ** 2, 0) /
      (bedtimeMins.length - 1);
    bedtimeStdev = Math.sqrt(variance);
  }
  const bedtimeAvgStr =
    bedtimeAvgMin != null ? minutesToHHMM(bedtimeAvgMin) : null;
  const bedtimeConsistencyColor =
    bedtimeStdev == null
      ? "var(--text-muted)"
      : bedtimeStdev < 30
        ? "var(--green)"
        : bedtimeStdev < 60
          ? "var(--yellow)"
          : "var(--red)";
  // Last 14 nights for sparkline (minutes since midnight)
  const bedtimeSpark = bedtimes30
    .slice(-14)
    .map((b) => bedtimeToMinutes(b.time));

  // Recent workouts
  const recentWorkouts = snaps30
    .filter((s) => s.last_workout != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Body comp
  const latestWeightStr = latestWeight != null ? `${latestWeight}kg` : "—";
  const latestWaistStr = latestWaist != null ? `${latestWaist}cm` : "—";

  // ACWR note
  let acwrNote = "";
  if (trends.acwr !== null) {
    if (trends.acwr < 0.8) acwrNote = "detraining";
    else if (trends.acwr <= 1.3) acwrNote = "sweet spot";
    else if (trends.acwr <= 1.5) acwrNote = "high — consider deload";
    else acwrNote = "overreaching risk";
  }

  // Polarized note
  const paRatio = pa.ratio != null ? pa.ratio.toFixed(2) : "∞";

  // Last-update timestamp (server render time in Zurich)
  const updatedAt = new Date().toLocaleTimeString("en-CH", {
    timeZone: "Europe/Zurich",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <>
      {/* page-level style block removed — global tokens are in layout.tsx */}
      <PullToRefresh />

      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          padding: "1rem",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.35rem",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              color: "var(--text)",
            }}
          >
            TRAINING COACH
          </h1>
          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
            {todayISO}
          </span>
        </div>
        {/* Last-update timestamp */}
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--text-dim)",
            marginBottom: "0.75rem",
            letterSpacing: "0.03em",
          }}
        >
          Updated {updatedAt}
        </div>

        {/* TODAY hero — sticky wrapper collapses on scroll */}
        <StickyToday
          recColor={recColor}
          recStr={recStr}
          recEmoji={recEmoji}
          coachOpener={coachOpener}
          hrvStr={hrvStr}
          rhrStr={rhrStr}
          sleepEffStr={sleepEffStr}
          sleepDurStr={sleepDurStr}
          todayPlan={todayPlan}
        >
          <div
            style={{
              background:
                "linear-gradient(135deg, var(--bg-card) 0%, var(--bg) 100%)",
              borderRadius: "16px",
              padding: "1.25rem 1.5rem",
              marginBottom: "0.75rem",
              border: `1px solid ${recColor}33`,
              boxShadow: `0 0 20px ${recColor}18`,
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-dim)",
                marginBottom: "0.6rem",
                fontWeight: 600,
              }}
            >
              TODAY
            </div>

            {/* Recovery score — big, with glow */}
            <div
              className="mono metric-glow"
              style={{
                fontSize: "3rem",
                fontWeight: 700,
                color: recColor,
                lineHeight: 1,
                marginBottom: "0.25rem",
              }}
            >
              {recStr}
            </div>

            {/* Coach voice */}
            <div
              style={{
                fontSize: "0.9rem",
                color: "var(--text-muted)",
                fontStyle: "italic",
                marginBottom: "0.75rem",
                lineHeight: 1.4,
              }}
            >
              "{coachOpener}"
            </div>

            {/* HRV / RHR / Sleep row */}
            <div
              style={{
                display: "flex",
                gap: "1rem",
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginBottom: todayPlan ? "0.75rem" : "0",
                flexWrap: "wrap",
              }}
            >
              <span>
                HRV <strong style={{ color: "var(--text)" }}>{hrvStr}</strong>
              </span>
              <span>
                RHR <strong style={{ color: "var(--text)" }}>{rhrStr}</strong>
              </span>
              <span>
                Sleep{" "}
                <strong style={{ color: "var(--text)" }}>
                  {sleepEffStr}
                  {sleepDurStr}
                </strong>
              </span>
            </div>

            {/* Today's plan */}
            {todayPlan && (
              <div
                style={{
                  background: "var(--bg)",
                  borderRadius: "8px",
                  padding: "0.5rem 0.75rem",
                  fontSize: "0.8rem",
                  color: "var(--text)",
                  borderLeft: `3px solid ${recColor}`,
                }}
              >
                {todayPlan}
              </div>
            )}
          </div>
        </StickyToday>

        {/* Quick streaks bar */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            padding: "0.6rem 1rem",
            background: "var(--bg-surface)",
            borderRadius: "10px",
            marginBottom: "0.75rem",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
          }}
        >
          <span>
            Green streak{" "}
            <strong style={{ color: "var(--green)" }}>
              {streaks.green_recovery}d
            </strong>
          </span>
          <span>
            No-skip{" "}
            <strong style={{ color: "var(--green)" }}>
              {streaks.no_skip}d
            </strong>
          </span>
          <span>
            Best{" "}
            <strong style={{ color: "var(--text-muted)" }}>
              {streaks.best_green_recovery}d
            </strong>
          </span>
        </div>

        {/* 13-week tappable recovery heatmap — always visible */}
        <Widget title="Recovery heatmap — 13 weeks">
          <Heatmap scores={heatmapScores} todayISO={todayISO} />
        </Widget>

        {/* Detail sections — shown only with ?detail=1 */}
        {showDetail && (
          <>
            {/* HRV trend chart — segmented pill control */}
            <Widget title="HRV">
              <TrendChart
                metric="hrv"
                data91={hrv91}
                color="var(--green)"
                unit="ms"
              />
              {hrvCv != null && (
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "0.75rem",
                    color: "var(--text-dim)",
                  }}
                >
                  CV {hrvCv.toFixed(1)}%
                </div>
              )}
            </Widget>

            {/* RHR trend chart */}
            <Widget title="RHR">
              <TrendChart
                metric="rhr"
                data91={rhr91}
                color="var(--red)"
                unit="bpm"
                lowerIsBetter
              />
            </Widget>

            {/* Sleep efficiency trend chart */}
            <Widget title="Sleep Efficiency">
              <TrendChart
                metric="sleep"
                data91={sleep91}
                color="var(--primary-light)"
                unit="%"
              />
            </Widget>

            {/* Strain trend chart */}
            <Widget title="Strain">
              <TrendChart
                metric="strain"
                data91={strain91}
                color="var(--accent)"
                unit=""
              />
            </Widget>

            {/* Bedtime consistency widget */}
            {bedtimes30.length >= 2 && (
              <Widget title="BEDTIME CONSISTENCY">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "1.6rem",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: "var(--text)",
                        lineHeight: 1.1,
                      }}
                    >
                      {bedtimeAvgStr ?? "—"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-dim)",
                        marginTop: "0.15rem",
                      }}
                    >
                      30-day avg
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "1.3rem",
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        color: bedtimeConsistencyColor,
                        lineHeight: 1.1,
                      }}
                    >
                      {bedtimeStdev != null
                        ? `±${Math.round(bedtimeStdev)}m`
                        : "—"}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-dim)",
                        marginTop: "0.15rem",
                      }}
                    >
                      std dev
                    </div>
                  </div>
                </div>
                {/* 14-night sparkline */}
                {bedtimeSpark.length >= 2 &&
                  (() => {
                    const min = Math.min(...bedtimeSpark);
                    const max = Math.max(...bedtimeSpark);
                    const range = max - min || 1;
                    const w = 280;
                    const h = 40;
                    const pts = bedtimeSpark
                      .map((v, i) => {
                        const x = (i / (bedtimeSpark.length - 1)) * w;
                        const y = h - ((v - min) / range) * (h - 4) - 2;
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(" ");
                    return (
                      <svg
                        width="100%"
                        height={h}
                        viewBox={`0 0 ${w} ${h}`}
                        preserveAspectRatio="none"
                      >
                        <polyline
                          points={pts}
                          fill="none"
                          stroke={bedtimeConsistencyColor}
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      </svg>
                    );
                  })()}
                <div
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "0.72rem",
                    color: "var(--text-dim)",
                  }}
                >
                  {bedtimes30.length} nights logged · last 14 nights shown
                </div>
              </Widget>
            )}

            {/* Week-over-week comparison */}
            <Widget title="WEEK OVER WEEK">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto auto",
                  gap: "0.15rem 0.75rem",
                  fontSize: "0.8rem",
                }}
              >
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                  Metric
                </span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                  This wk
                </span>
                <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
                  vs last wk
                </span>

                {(
                  [
                    {
                      label: "HRV",
                      curr: wow.hrv_this,
                      prev: wow.hrv_prev,
                      fmt: (v: number) => `${v.toFixed(1)}ms`,
                      higherIsBetter: true,
                    },
                    {
                      label: "RHR",
                      curr: wow.rhr_this,
                      prev: wow.rhr_prev,
                      fmt: (v: number) => `${v.toFixed(1)}bpm`,
                      higherIsBetter: false,
                    },
                    {
                      label: "Sleep",
                      curr: wow.sleep_this,
                      prev: wow.sleep_prev,
                      fmt: (v: number) => `${v.toFixed(1)}%`,
                      higherIsBetter: true,
                    },
                    {
                      label: "Strain",
                      curr: wow.strain_this,
                      prev: wow.strain_prev,
                      fmt: (v: number) => v.toFixed(1),
                      higherIsBetter: true,
                    },
                  ] as {
                    label: string;
                    curr: number | null;
                    prev: number | null;
                    fmt: (v: number) => string;
                    higherIsBetter: boolean;
                  }[]
                ).map(({ label, curr, prev, fmt, higherIsBetter }) => {
                  const d = curr != null && prev != null ? curr - prev : null;
                  const pct =
                    d != null && prev != null && prev !== 0
                      ? (d / prev) * 100
                      : null;
                  const isGood =
                    d == null
                      ? null
                      : d === 0
                        ? null
                        : higherIsBetter
                          ? d > 0
                          : d < 0;
                  const col =
                    isGood == null
                      ? "var(--text-dim)"
                      : isGood
                        ? "var(--green)"
                        : "var(--red)";
                  const arrow =
                    d == null ? "" : d > 0 ? "▲" : d < 0 ? "▼" : "—";
                  return (
                    <>
                      <span
                        key={`${label}-label`}
                        style={{ color: "var(--text-muted)" }}
                      >
                        {label}
                      </span>
                      <span
                        key={`${label}-curr`}
                        style={{ fontWeight: 600, color: "var(--text)" }}
                      >
                        {curr != null ? fmt(curr) : "—"}
                      </span>
                      <span
                        key={`${label}-delta`}
                        style={{ color: col, fontWeight: d !== 0 ? 600 : 400 }}
                      >
                        {pct != null
                          ? `${arrow} ${Math.abs(pct).toFixed(1)}%`
                          : prev != null
                            ? fmt(prev)
                            : "—"}
                      </span>
                    </>
                  );
                })}
              </div>
            </Widget>

            {/* Goals progress */}
            {goals && (
              <Widget title="GOALS">
                {(["hrv", "rhr", "weight", "waist"] as const).map((field) => {
                  const goalVal = goals[field];
                  if (goalVal == null) return null;
                  const currentVal =
                    field === "hrv"
                      ? latestHrv
                      : field === "rhr"
                        ? latestRhr
                        : field === "weight"
                          ? latestWeight
                          : latestWaist;
                  if (currentVal == null) return null;

                  // For RHR and weight/waist, lower is better — invert progress
                  const higherIsBetter = field === "hrv";
                  const progress = higherIsBetter
                    ? currentVal / goalVal
                    : goalVal / currentVal;
                  const bar = progressBar(Math.round(progress * 5), 5, 5);
                  const unit =
                    field === "hrv"
                      ? "ms"
                      : field === "rhr"
                        ? "bpm"
                        : field === "weight"
                          ? "kg"
                          : "cm";

                  return (
                    <div
                      key={field}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.2rem 0",
                        fontSize: "0.85rem",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-muted)",
                          textTransform: "uppercase",
                          fontSize: "0.75rem",
                        }}
                      >
                        {field}
                      </span>
                      <span
                        style={{
                          color: "var(--green)",
                          fontFamily: "monospace",
                          letterSpacing: "0.05em",
                        }}
                      >
                        {bar}
                      </span>
                      <span
                        style={{
                          color: "var(--text-dim)",
                          fontSize: "0.75rem",
                        }}
                      >
                        {currentVal.toFixed(field === "hrv" ? 0 : 1)}
                        {unit} → {goalVal}
                        {unit}
                      </span>
                    </div>
                  );
                })}
                {proteinRate != null && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.2rem 0",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        fontSize: "0.75rem",
                      }}
                    >
                      Protein 7d
                    </span>
                    <span
                      style={{
                        color: "var(--green)",
                        fontFamily: "monospace",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {progressBar(proteinHits, proteinHistory.length, 7)}
                    </span>
                    <span
                      style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}
                    >
                      {proteinHits}/{proteinHistory.length} days
                    </span>
                  </div>
                )}
              </Widget>
            )}

            {/* Training load */}
            <Widget title="TRAINING LOAD">
              <StatRow
                label="Acute 7d avg"
                value={
                  trends.strain_7day_avg != null
                    ? trends.strain_7day_avg.toFixed(1)
                    : "—"
                }
              />
              <StatRow
                label="Chronic 28d avg"
                value={
                  trends.strain_28day_avg != null
                    ? trends.strain_28day_avg.toFixed(1)
                    : "—"
                }
              />
              {trends.acwr != null && (
                <StatRow
                  label="ACWR"
                  value={`${trends.acwr.toFixed(2)}`}
                  delta={acwrNote}
                />
              )}
              {pa.compliance !== "unknown" && (
                <StatRow
                  label="Polarized ratio"
                  value={`${paRatio}`}
                  delta={pa.compliance}
                />
              )}
            </Widget>

            {/* Streaks + Body */}
            <div className="two-col">
              <Widget title="STREAKS">
                <StatRow
                  label="Green recovery"
                  value={`🔥 ${streaks.green_recovery}d`}
                />
                <StatRow
                  label="Best"
                  value={`${streaks.best_green_recovery}d`}
                />
                <StatRow label="No-skip" value={`✓ ${streaks.no_skip}d`} />
              </Widget>
              <Widget title="BODY">
                <StatRow label="Weight" value={latestWeightStr} />
                <StatRow label="Waist" value={latestWaistStr} />
                {weightHistory.length >= 2 && (
                  <StatRow
                    label="Δ weight"
                    value={(() => {
                      const delta =
                        weightHistory[weightHistory.length - 1].value -
                        weightHistory[0].value;
                      return (delta >= 0 ? "+" : "") + delta.toFixed(1) + "kg";
                    })()}
                  />
                )}
              </Widget>
            </div>

            {/* Recent workouts */}
            {recentWorkouts.length > 0 && (
              <Widget title="RECENT WORKOUTS">
                {recentWorkouts.map((s) => {
                  const w = s.last_workout!;
                  return (
                    <div
                      key={s.date}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "5rem 1fr auto",
                        gap: "0.5rem",
                        alignItems: "center",
                        padding: "0.3rem 0",
                        borderBottom: "1px solid #0f172a",
                        fontSize: "0.8rem",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-dim)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {s.date.slice(5)}
                      </span>
                      <span style={{ color: "var(--text)" }}>{w.sport}</span>
                      <span
                        style={{
                          color: "var(--text-dim)",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {w.strain.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </Widget>
            )}
          </>
        )}

        {/* Detail toggle link */}
        <div
          style={{
            textAlign: "center",
            color: "var(--text-dim)",
            fontSize: "0.75rem",
            paddingTop: "0.5rem",
          }}
        >
          {showDetail ? (
            <a href="?" style={{ color: "var(--text-dim)" }}>
              ← hero only
            </a>
          ) : (
            <a href="?detail=1" style={{ color: "var(--text-dim)" }}>
              + full detail
            </a>
          )}
        </div>

        <div
          style={{
            textAlign: "center",
            color: "var(--border)",
            fontSize: "0.7rem",
            paddingTop: "0.5rem",
            paddingBottom: "1.5rem",
          }}
        >
          training-coach v8
        </div>
      </div>
    </>
  );
}
