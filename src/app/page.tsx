import {
  listBiometricSnapshots,
  listBodyMeasurements,
  isSkipped,
  listAllGoals,
  listProtein,
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

// ── SVG Sparkline ─────────────────────────────────────────────────────────────

function Sparkline({
  values,
  color = "var(--green)",
  height = 60,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (values.length < 2)
    return <span style={{ color: "var(--text-dim)" }}>—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 280;
  const h = height;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
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
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── 90-day heatmap ────────────────────────────────────────────────────────────

function RecoveryHeatmap({
  scores,
}: {
  scores: Array<{ date: string; score: number | null }>;
}) {
  // Build 13 columns × 7 rows grid (Sun–Sat), most-recent column on the right
  // Pad start so the first cell is Sunday
  const firstDate = scores.length > 0 ? scores[0].date : null;
  const startDow = firstDate
    ? new Date(firstDate + "T12:00:00Z").getUTCDay()
    : 0;

  const cells: Array<{ date: string; score: number | null } | null> = [
    ...Array(startDow).fill(null),
    ...scores,
  ];

  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: Array<Array<{ date: string; score: number | null } | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const cellSize = 14;
  const gap = 2;
  const cols = weeks.length;
  const rows = 7;
  const svgW = cols * (cellSize + gap) - gap;
  const svgH = rows * (cellSize + gap) - gap;

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`}>
        {weeks.map((week, wi) =>
          week.map((cell, di) => {
            if (!cell) return null;
            const x = wi * (cellSize + gap);
            const y = di * (cellSize + gap);
            const color =
              cell.score == null
                ? "var(--bg-card)"
                : cell.score >= 67
                  ? "var(--green)"
                  : cell.score >= 34
                    ? "var(--yellow)"
                    : "var(--red)";
            return (
              <rect
                key={`${wi}-${di}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx="2"
                fill={color}
                opacity={cell.score == null ? 0.3 : 0.85}
              />
            );
          }),
        )}
      </svg>
      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          marginTop: "0.4rem",
          fontSize: "0.7rem",
          color: "var(--text-dim)",
        }}
      >
        <span>
          <span style={{ color: "var(--green)" }}>■</span> Green ≥67%
        </span>
        <span>
          <span style={{ color: "var(--yellow)" }}>■</span> Yellow 34–66%
        </span>
        <span>
          <span style={{ color: "var(--red)" }}>■</span> Red &lt;34%
        </span>
      </div>
    </div>
  );
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

// ── Week-over-week comparison helpers ─────────────────────────────────────────

function wowDelta(
  curr: number | null,
  prev: number | null,
  higherIsBetter: boolean,
): string {
  if (curr == null || prev == null || prev === 0) return "";
  const diff = curr - prev;
  const pct = (diff / prev) * 100;
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
  const sign = diff > 0 ? "+" : "";
  const good = higherIsBetter ? diff > 0 : diff < 0;
  const color = good
    ? "var(--green)"
    : diff === 0
      ? "var(--text-muted)"
      : "var(--red)";
  return `<span style="color:${color}">${arrow} ${sign}${pct.toFixed(1)}%</span>`;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function Page({ searchParams }: Props) {
  const { key, detail } = await searchParams;
  if (!(await isAuthorized(key))) {
    return <UnauthorizedView />;
  }
  const showDetail = detail === "1";

  // ── Data fetching ──────────────────────────────────────────────────────────
  const dataFetches: Promise<unknown>[] = [
    listBiometricSnapshots(30),
    listBiometricSnapshots(60),
    listBodyMeasurements("weight", 30),
    listBodyMeasurements("waist", 30),
  ];

  if (showDetail) {
    dataFetches.push(
      listBiometricSnapshots(90),
      listAllGoals(),
      listProtein(7),
    );
  }

  const results = await Promise.all(dataFetches);
  const snaps30 = results[0] as BiometricSnapshot[];
  const snaps60 = results[1] as BiometricSnapshot[];
  const weightHistory = results[2] as Array<{ date: string; value: number }>;
  const waistHistory = results[3] as Array<{ date: string; value: number }>;
  const snaps90 = showDetail ? (results[4] as BiometricSnapshot[]) : [];
  const goals = showDetail
    ? (results[5] as Awaited<ReturnType<typeof listAllGoals>>)
    : null;
  const proteinHistory = showDetail
    ? (results[6] as Array<{ date: string; hit: boolean }>)
    : [];

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

  // RHR sparkline values
  const rhrValues = snaps30
    .filter((s) => typeof s.recovery.rhr_bpm === "number")
    .map((s) => s.recovery.rhr_bpm as number);

  // Sleep efficiency sparkline values
  const sleepValues = snaps30
    .filter((s) => s.sleep != null)
    .map((s) => s.sleep!.efficiency_pct);

  // 90-day heatmap data
  const heatmapScores: Array<{ date: string; score: number | null }> =
    snaps90.map((s) => ({
      date: s.date,
      score:
        s.recovery.status === "scored" && s.recovery.score != null
          ? s.recovery.score
          : null,
    }));

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

  return (
    <>
      {/* page-level style block removed — global tokens are in layout.tsx */}

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
            marginBottom: "1rem",
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

        {/* Detail sections — shown only with ?detail=1 */}
        {showDetail && (
          <>
            {/* 90-day recovery heatmap */}
            <Widget title={`Recovery heatmap — 90 days`}>
              <RecoveryHeatmap scores={heatmapScores} />
            </Widget>

            {/* HRV sparkline */}
            <Widget title={`HRV — last ${snaps30.length} days`}>
              <Sparkline values={hrvValues} color="var(--green)" />
              <div
                style={{
                  display: "flex",
                  gap: "1rem",
                  marginTop: "0.4rem",
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  flexWrap: "wrap",
                }}
              >
                <span>
                  Avg {hrvAvg != null ? `${hrvAvg.toFixed(1)}ms` : "—"}
                </span>
                {hrvCv != null && <span>CV {hrvCv.toFixed(1)}%</span>}
                <span>
                  Latest{" "}
                  {hrvLatest != null ? `${Math.round(hrvLatest)}ms` : "—"}
                </span>
              </div>
            </Widget>

            {/* RHR sparkline */}
            {rhrValues.length >= 2 && (
              <Widget title={`RHR — last ${snaps30.length} days`}>
                <Sparkline values={rhrValues} color="var(--red)" />
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginTop: "0.4rem",
                  }}
                >
                  Avg{" "}
                  {(
                    rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length
                  ).toFixed(1)}
                  bpm
                </div>
              </Widget>
            )}

            {/* Sleep efficiency sparkline */}
            {sleepValues.length >= 2 && (
              <Widget title={`Sleep efficiency — last ${snaps30.length} days`}>
                <Sparkline values={sleepValues} color="var(--primary-light)" />
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginTop: "0.4rem",
                  }}
                >
                  Avg{" "}
                  {(
                    sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
                  ).toFixed(1)}
                  %
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
                  Last wk
                </span>

                <span style={{ color: "var(--text-muted)" }}>HRV</span>
                <span style={{ fontWeight: 600 }}>
                  {wow.hrv_this != null ? `${wow.hrv_this.toFixed(1)}ms` : "—"}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {wow.hrv_prev != null ? `${wow.hrv_prev.toFixed(1)}ms` : "—"}
                  {wow.hrv_this != null && wow.hrv_prev != null
                    ? (() => {
                        const d = wow.hrv_this - wow.hrv_prev;
                        const good = d > 0;
                        const col =
                          d > 0
                            ? "var(--green)"
                            : d < 0
                              ? "var(--red)"
                              : "var(--text-muted)";
                        return (
                          <span style={{ color: col, marginLeft: "0.25rem" }}>
                            {d > 0 ? "↑" : d < 0 ? "↓" : "→"}
                          </span>
                        );
                      })()
                    : null}
                </span>

                <span style={{ color: "var(--text-muted)" }}>RHR</span>
                <span style={{ fontWeight: 600 }}>
                  {wow.rhr_this != null ? `${wow.rhr_this.toFixed(1)}bpm` : "—"}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {wow.rhr_prev != null ? `${wow.rhr_prev.toFixed(1)}bpm` : "—"}
                  {wow.rhr_this != null && wow.rhr_prev != null
                    ? (() => {
                        const d = wow.rhr_this - wow.rhr_prev;
                        const col =
                          d < 0
                            ? "var(--green)"
                            : d > 0
                              ? "var(--red)"
                              : "var(--text-muted)";
                        return (
                          <span style={{ color: col, marginLeft: "0.25rem" }}>
                            {d < 0 ? "↑" : d > 0 ? "↓" : "→"}
                          </span>
                        );
                      })()
                    : null}
                </span>

                <span style={{ color: "var(--text-muted)" }}>Sleep</span>
                <span style={{ fontWeight: 600 }}>
                  {wow.sleep_this != null
                    ? `${wow.sleep_this.toFixed(1)}%`
                    : "—"}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {wow.sleep_prev != null
                    ? `${wow.sleep_prev.toFixed(1)}%`
                    : "—"}
                  {wow.sleep_this != null && wow.sleep_prev != null
                    ? (() => {
                        const d = wow.sleep_this - wow.sleep_prev;
                        const col =
                          d > 0
                            ? "var(--green)"
                            : d < 0
                              ? "var(--red)"
                              : "var(--text-muted)";
                        return (
                          <span style={{ color: col, marginLeft: "0.25rem" }}>
                            {d > 0 ? "↑" : d < 0 ? "↓" : "→"}
                          </span>
                        );
                      })()
                    : null}
                </span>

                <span style={{ color: "var(--text-muted)" }}>Strain</span>
                <span style={{ fontWeight: 600 }}>
                  {wow.strain_this != null ? wow.strain_this.toFixed(1) : "—"}
                </span>
                <span style={{ color: "var(--text-dim)" }}>
                  {wow.strain_prev != null ? wow.strain_prev.toFixed(1) : "—"}
                </span>
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
