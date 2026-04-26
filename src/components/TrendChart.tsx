"use client";

import { useEffect, useState } from "react";

type Period = "7d" | "30d" | "90d" | "365d";

interface DataPoint {
  date: string;
  value: number;
}

interface Props {
  /** Metric identifier — used as localStorage key prefix */
  metric: "hrv" | "rhr" | "sleep" | "strain";
  /** Pre-fetched data for the past 91 days (server-side), sorted oldest→newest */
  data91: DataPoint[];
  color?: string;
  unit?: string;
  /** If true, lower values = better (RHR, body weight) */
  lowerIsBetter?: boolean;
}

const PERIODS: Period[] = ["7d", "30d", "90d", "365d"];
const PERIOD_DAYS: Record<Period, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 91,
  "365d": 365,
};

const LS_KEY_PREFIX = "tc_trend_period_";

/**
 * Segmented sparkline with [7d][30d][90d][365d] pill selector.
 * - 7d/30d/90d: sliced from server-provided data91 — zero extra fetches.
 * - 365d: fetches /api/trend/[metric] lazily on first selection.
 * - Selected period is persisted in localStorage per metric.
 * - Weekly aggregation for 365d view (reduces 365 points → ~52).
 */
export default function TrendChart({
  metric,
  data91,
  color = "var(--primary-light)",
  unit = "",
  lowerIsBetter = false,
}: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data365, setData365] = useState<DataPoint[] | null>(null);
  const [loading365, setLoading365] = useState(false);

  // Restore persisted period on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_PREFIX + metric) as Period | null;
    if (saved && PERIODS.includes(saved)) setPeriod(saved);
  }, [metric]);

  // Fetch 365d data when that period is selected
  useEffect(() => {
    if (period !== "365d" || data365 || loading365) return;
    setLoading365(true);
    fetch(`/api/trend/${metric}?days=365`)
      .then((r) => r.json())
      .then((d: { points: DataPoint[] }) => {
        setData365(d.points ?? []);
        setLoading365(false);
      })
      .catch(() => {
        setData365([]);
        setLoading365(false);
      });
  }, [period, metric, data365, loading365]);

  function selectPeriod(p: Period) {
    setPeriod(p);
    localStorage.setItem(LS_KEY_PREFIX + metric, p);
  }

  // Determine data to display
  function getDisplayData(): DataPoint[] {
    if (period === "365d") {
      if (!data365 || data365.length === 0) return [];
      return weeklyAggregate(data365);
    }
    const days = PERIOD_DAYS[period];
    return data91.slice(-days);
  }

  const displayData = getDisplayData();
  const values = displayData.map((d) => d.value);

  const avg =
    values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  const latest = values.length > 0 ? values[values.length - 1] : null;
  const first = values.length > 0 ? values[0] : null;

  // Trend direction
  const trendColor =
    latest != null && first != null
      ? Math.abs(latest - first) < 0.5
        ? "var(--text-dim)"
        : lowerIsBetter
          ? latest < first
            ? "var(--green)"
            : "var(--red)"
          : latest > first
            ? "var(--green)"
            : "var(--red)"
      : "var(--text-dim)";

  const trendArrow =
    latest != null && first != null
      ? latest > first + 0.5
        ? "↑"
        : latest < first - 0.5
          ? "↓"
          : "→"
      : null;

  return (
    <div>
      {/* Period selector pill */}
      <div
        style={{
          display: "flex",
          gap: "2px",
          marginBottom: "0.5rem",
          background: "var(--bg)",
          borderRadius: "8px",
          padding: "2px",
          width: "fit-content",
        }}
      >
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => selectPeriod(p)}
            style={{
              background: period === p ? "var(--bg-surface)" : "transparent",
              border:
                period === p
                  ? "1px solid var(--border)"
                  : "1px solid transparent",
              borderRadius: "6px",
              color: period === p ? "var(--text)" : "var(--text-dim)",
              cursor: "pointer",
              fontSize: "0.7rem",
              fontWeight: period === p ? 600 : 400,
              padding: "0.2rem 0.5rem",
              transition: "all 120ms ease",
              fontFamily: "var(--font-mono)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      {period === "365d" && loading365 ? (
        <div
          style={{
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-dim)",
            fontSize: "0.8rem",
          }}
        >
          Loading…
        </div>
      ) : displayData.length < 2 ? (
        <div
          style={{
            height: 60,
            display: "flex",
            alignItems: "center",
            color: "var(--text-dim)",
            fontSize: "0.8rem",
          }}
        >
          Not enough data
        </div>
      ) : (
        <InlineSpark values={values} color={color} />
      )}

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginTop: "0.35rem",
          fontSize: "0.78rem",
          color: "var(--text-muted)",
          flexWrap: "wrap",
        }}
      >
        {avg != null && (
          <span>
            Avg{" "}
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {avg.toFixed(unit === "ms" ? 0 : 1)}
              {unit}
            </span>
          </span>
        )}
        {latest != null && (
          <span>
            Latest{" "}
            <span style={{ fontWeight: 600, color: "var(--text)" }}>
              {latest.toFixed(unit === "ms" ? 0 : 1)}
              {unit}
            </span>
          </span>
        )}
        {trendArrow && (
          <span style={{ color: trendColor, fontWeight: 600 }}>
            {trendArrow}
          </span>
        )}
      </div>
    </div>
  );
}

// ── SVG sparkline (inline, no external deps) ──────────────────────────────────

function InlineSpark({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 280;
  const h = 60;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Area path (for fill under curve)
  const firstX = 0;
  const lastX = w;
  const areaPath = `M${firstX},${h} ${points
    .split(" ")
    .map((p) => `L${p}`)
    .join(" ")} L${lastX},${h} Z`;

  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={`grad-${color.replace(/[^a-z]/gi, "")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace(/[^a-z]/gi, "")})`} />
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

// ── Weekly aggregation for 365d view ─────────────────────────────────────────

function weeklyAggregate(data: DataPoint[]): DataPoint[] {
  if (data.length === 0) return [];
  const buckets = new Map<string, number[]>();
  for (const { date, value } of data) {
    // Week key: ISO week — use Mon as start by finding Mon of that week
    const d = new Date(date + "T12:00:00Z");
    const dow = (d.getUTCDay() + 6) % 7; // Mon=0
    const mon = new Date(d.getTime() - dow * 86400000);
    const weekKey = mon.toISOString().slice(0, 10);
    const arr = buckets.get(weekKey) ?? [];
    arr.push(value);
    buckets.set(weekKey, arr);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      value: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));
}
