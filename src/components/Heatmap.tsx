"use client";

import { useState } from "react";
import DayDetailSheet from "./DayDetailSheet";

interface Cell {
  date: string;
  score: number | null;
}

interface Props {
  /** 91 days (13 × 7) of recovery scores, oldest first */
  scores: Cell[];
  todayISO: string;
}

/**
 * 13-week tappable recovery heatmap.
 * Layout: 7 rows (Mon–Sun) × 13 columns (oldest→newest left→right).
 * Each cell is a <button> ≥44px for touch target.
 * Tapping a cell with data opens a DayDetailSheet.
 */
export default function Heatmap({ scores, todayISO }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build exactly 91 cells (13 weeks × 7 days), Mon-first
  // Find start date: go back to the Monday of the week 13 weeks ago
  const today = new Date(todayISO + "T12:00:00Z");
  // Day of week: 0=Sun ... 6=Sat → shift so Mon=0
  const todayDow = (today.getUTCDay() + 6) % 7; // 0=Mon … 6=Sun
  const msPerDay = 24 * 3600 * 1000;
  // Start from the Monday 12 full weeks before the current week's Monday
  // (so we always show 13 columns of 7 rows = 91 cells ending on today's week)
  const gridStart = new Date(today.getTime() - (todayDow + 7 * 12) * msPerDay);

  // Build a lookup map for quick access
  const scoreMap = new Map<string, number | null>();
  for (const c of scores) scoreMap.set(c.date, c.score);

  // Build 13 columns × 7 rows
  const columns: Array<
    Array<{ date: string; score: number | null; isFuture: boolean }>
  > = [];
  for (let week = 0; week < 13; week++) {
    const col: Array<{
      date: string;
      score: number | null;
      isFuture: boolean;
    }> = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(gridStart.getTime() + (week * 7 + day) * msPerDay);
      const iso = d.toISOString().slice(0, 10);
      const isFuture = iso > todayISO;
      col.push({
        date: iso,
        score: isFuture ? null : (scoreMap.get(iso) ?? null),
        isFuture,
      });
    }
    columns.push(col);
  }

  // Day labels Mon–Sun
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];

  return (
    <>
      <div
        style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `1.2rem repeat(13, 1fr)`,
            gap: "3px",
            minWidth: "280px",
          }}
        >
          {/* Day label column */}
          {dayLabels.map((label, i) => (
            <div
              key={`label-${i}`}
              style={{
                fontSize: "0.6rem",
                color: "var(--text-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "44px",
              }}
            >
              {label}
            </div>
          ))}

          {/* Heatmap cells — 13 columns × 7 rows */}
          {Array.from({ length: 7 }, (_, dayIdx) =>
            columns.map((col, weekIdx) => {
              const cell = col[dayIdx];
              const color = cell.isFuture
                ? "transparent"
                : cell.score == null
                  ? "var(--bg-surface)"
                  : cell.score >= 67
                    ? "var(--green)"
                    : cell.score >= 34
                      ? "var(--yellow)"
                      : "var(--red)";
              const isToday = cell.date === todayISO;
              const hasData = !cell.isFuture;

              return (
                <button
                  key={`${weekIdx}-${dayIdx}`}
                  onClick={() =>
                    hasData ? setSelectedDate(cell.date) : undefined
                  }
                  aria-label={
                    cell.isFuture
                      ? cell.date
                      : cell.score != null
                        ? `${cell.date}: recovery ${cell.score}%`
                        : `${cell.date}: no data`
                  }
                  style={{
                    background: color,
                    border: isToday
                      ? "2px solid var(--text)"
                      : cell.isFuture
                        ? "none"
                        : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "4px",
                    minHeight: "44px",
                    minWidth: "100%",
                    cursor: hasData ? "pointer" : "default",
                    opacity: cell.isFuture
                      ? 0
                      : cell.score == null
                        ? 0.25
                        : 0.85,
                    padding: 0,
                    transition: "opacity 120ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (hasData)
                      (e.currentTarget as HTMLButtonElement).style.opacity =
                        "1";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity =
                      cell.score == null ? "0.25" : "0.85";
                  }}
                />
              );
            }),
          )}
        </div>

        {/* Legend */}
        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginTop: "0.5rem",
            fontSize: "0.7rem",
            color: "var(--text-dim)",
          }}
        >
          <span>
            <span style={{ color: "var(--green)" }}>■</span> ≥67%
          </span>
          <span>
            <span style={{ color: "var(--yellow)" }}>■</span> 34–66%
          </span>
          <span>
            <span style={{ color: "var(--red)" }}>■</span> &lt;34%
          </span>
          <span style={{ marginLeft: "auto" }}>tap to inspect</span>
        </div>
      </div>

      {/* Day detail bottom sheet */}
      {selectedDate && (
        <DayDetailSheet
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
        />
      )}
    </>
  );
}
