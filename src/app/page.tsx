import {
  listBiometricSnapshots,
  listBodyMeasurements,
  isSkipped,
} from "@/lib/kv";
import { computeTrends } from "@/lib/trends";
import { computeStreaks } from "@/lib/streak";
import type { BiometricSnapshot } from "@/lib/whoop";
import { polarizedAnalysis, toMetrics } from "@/lib/analytics";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlan, pickToday } from "@/lib/plan";
import { cookies } from "next/headers";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ key?: string }>;
}

// ── Auth helper (read-only — cookie setting happens in /api/auth/dashboard) ───

async function isAuthorized(
  searchParamsKey: string | undefined,
): Promise<boolean> {
  const expected = process.env.DASHBOARD_SECRET;
  if (!expected) return false;

  // Check cookie first
  const cookieStore = await cookies();
  const session = cookieStore.get("tc_session")?.value;
  if (session) {
    const enc = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      enc.encode(expected),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode("ok"));
    const sigHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    if (session === sigHex) return true;
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
      <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#94a3b8" }}>
        Access denied
      </h1>
      <p style={{ margin: 0, color: "#475569", fontSize: "0.875rem" }}>
        Visit /api/auth/dashboard?key=YOUR_SECRET to authenticate
      </p>
    </div>
  );
}

// ── SVG Charts ────────────────────────────────────────────────────────────────

function HrvChart({ values }: { values: number[] }) {
  if (values.length < 2) return <div style={{ color: "#475569" }}>No data</div>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 300;
  const h = 80;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
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
        points={points}
        fill="none"
        stroke="#4ade80"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RecoveryBars({ scores }: { scores: (number | null)[] }) {
  const w = 300;
  const h = 80;
  const barW = w / scores.length;
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {scores.map((s, i) => {
        if (s == null) return null;
        const color = s >= 67 ? "#4ade80" : s >= 34 ? "#facc15" : "#ef4444";
        const barH = (s / 100) * h;
        return (
          <rect
            key={i}
            x={i * barW}
            y={h - barH}
            width={Math.max(barW - 1, 0.5)}
            height={barH}
            fill={color}
          />
        );
      })}
    </svg>
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
        background: "#1e293b",
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        marginBottom: "0.75rem",
        border: "1px solid #334155",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#64748b",
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        padding: "0.15rem 0",
      }}
    >
      <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{value}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default async function Page({ searchParams }: Props) {
  const { key } = await searchParams;
  if (!(await isAuthorized(key))) {
    return <UnauthorizedView />;
  }

  // ── Data fetching ──────────────────────────────────────────────────────────
  const [snaps30raw, snaps60raw, weightHistory, waistHistory] =
    await Promise.all([
      listBiometricSnapshots(30),
      listBiometricSnapshots(60),
      listBodyMeasurements("weight", 30),
      listBodyMeasurements("waist", 30),
    ]);

  const snaps30 = snaps30raw as BiometricSnapshot[];
  const snaps60 = snaps60raw as BiometricSnapshot[];

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

  // HRV values for chart
  const hrvValues = snaps30
    .filter((s) => typeof s.recovery.hrv_rmssd_ms === "number")
    .map((s) => s.recovery.hrv_rmssd_ms as number);

  const hrvAvg =
    hrvValues.length > 0
      ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length
      : null;

  const hrvLatest = todaySnap?.recovery.hrv_rmssd_ms ?? null;

  // CV
  let hrvCv: number | null = null;
  if (hrvValues.length >= 2 && hrvAvg && hrvAvg > 0) {
    const variance =
      hrvValues.reduce((acc, v) => acc + (v - hrvAvg) ** 2, 0) /
      (hrvValues.length - 1);
    hrvCv = (Math.sqrt(variance) / hrvAvg) * 100;
  }

  // Recovery scores for bar chart (30 days, preserving gaps as null)
  const recByDate = new Map<string, number | null>();
  for (const s of snaps30) {
    recByDate.set(
      s.date,
      s.recovery.status === "scored" && s.recovery.score != null
        ? s.recovery.score
        : null,
    );
  }
  const recScores: (number | null)[] = snaps30.map(
    (s) => recByDate.get(s.date) ?? null,
  );

  // Today's recovery info
  const rec = todaySnap?.recovery;
  const recStr =
    rec?.status === "scored" ? `${rec.score ?? "?"}%` : (rec?.status ?? "—");
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

  // Recovery color
  const recColor =
    rec?.status === "scored" && rec.score != null
      ? rec.score >= 67
        ? "#4ade80"
        : rec.score >= 34
          ? "#facc15"
          : "#ef4444"
      : "#94a3b8";

  // Recent workouts
  const recentWorkouts = snaps30
    .filter((s) => s.last_workout != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Body comp
  const latestWeight =
    weightHistory.length > 0
      ? weightHistory[weightHistory.length - 1].value
      : null;
  const latestWaist =
    waistHistory.length > 0
      ? waistHistory[waistHistory.length - 1].value
      : null;

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
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        @media (max-width: 480px) { .two-col { grid-template-columns: 1fr; } }
      `}</style>

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
            }}
          >
            TRAINING COACH
          </h1>
          <span style={{ color: "#475569", fontSize: "0.75rem" }}>
            {todayISO}
          </span>
        </div>

        {/* Today */}
        <Widget title="TODAY">
          <div
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              color: recColor,
              lineHeight: 1,
              marginBottom: "0.4rem",
            }}
          >
            Recovery {recStr}
          </div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: "0.875rem",
              marginBottom: "0.5rem",
            }}
          >
            HRV {hrvStr} &middot; RHR {rhrStr} &middot; Sleep {sleepEffStr}
            {sleepDurStr}
          </div>
          {todayPlan && (
            <div
              style={{
                background: "#0f172a",
                borderRadius: "6px",
                padding: "0.4rem 0.6rem",
                fontSize: "0.8rem",
                color: "#cbd5e1",
              }}
            >
              {todayPlan}
            </div>
          )}
        </Widget>

        {/* HRV Chart */}
        <Widget title={`HRV — last ${snaps30.length} days`}>
          <HrvChart values={hrvValues} />
          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginTop: "0.4rem",
              fontSize: "0.8rem",
              color: "#94a3b8",
            }}
          >
            <span>Avg {hrvAvg != null ? `${hrvAvg.toFixed(1)}ms` : "—"}</span>
            {hrvCv != null && <span>CV {hrvCv.toFixed(1)}%</span>}
            <span>
              Latest {hrvLatest != null ? `${Math.round(hrvLatest)}ms` : "—"}
            </span>
          </div>
        </Widget>

        {/* Recovery Bars */}
        <Widget title={`Recovery — last ${snaps30.length} days`}>
          <RecoveryBars scores={recScores} />
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginTop: "0.4rem",
              fontSize: "0.75rem",
              color: "#64748b",
            }}
          >
            <span style={{ color: "#4ade80" }}>■</span>
            <span>≥67%</span>
            <span style={{ color: "#facc15" }}>■</span>
            <span>34–66%</span>
            <span style={{ color: "#ef4444" }}>■</span>
            <span>&lt;34%</span>
          </div>
        </Widget>

        {/* Streaks + Body */}
        <div className="two-col">
          <Widget title="STREAKS">
            <StatRow
              label="Green recovery"
              value={`🔥 ${streaks.green_recovery}d`}
            />
            <StatRow label="Best" value={`${streaks.best_green_recovery}d`} />
            <StatRow label="No-skip days" value={`✓ ${streaks.no_skip}d`} />
          </Widget>
          <Widget title="BODY">
            <StatRow
              label="Weight"
              value={latestWeight != null ? `${latestWeight}kg` : "—"}
            />
            <StatRow
              label="Waist"
              value={latestWaist != null ? `${latestWaist}cm` : "—"}
            />
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

        {/* Training load */}
        <Widget title="TRAINING LOAD (ACWR)">
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
              value={`${trends.acwr.toFixed(2)} — ${acwrNote}`}
            />
          )}
          {pa.compliance !== "unknown" && (
            <StatRow
              label="Polarized ratio"
              value={`${paRatio} (${pa.compliance})`}
            />
          )}
        </Widget>

        {/* Recent workouts */}
        {recentWorkouts.length > 0 && (
          <Widget title="RECENT WORKOUTS">
            {recentWorkouts.map((s) => {
              const w = s.last_workout!;
              return (
                <div
                  key={s.date}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "0.2rem 0",
                    borderBottom: "1px solid #1e293b",
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>{s.date}</span>
                  <span>{w.sport}</span>
                  <span style={{ color: "#64748b" }}>
                    strain {w.strain.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </Widget>
        )}

        <div
          style={{
            textAlign: "center",
            color: "#334155",
            fontSize: "0.7rem",
            paddingTop: "0.5rem",
            paddingBottom: "1.5rem",
          }}
        >
          training-coach v6
        </div>
      </div>
    </>
  );
}
