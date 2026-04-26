"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  recColor: string;
  recStr: string;
  recEmoji: string;
  coachOpener: string;
  hrvStr: string;
  rhrStr: string;
  sleepEffStr: string;
  sleepDurStr: string;
  todayPlan: string | null;
  children: React.ReactNode;
}

/**
 * Wraps the TODAY hero card in a sticky container.
 * When the card scrolls out of view, collapses to a compact strip
 * showing recovery emoji + score + first line of plan.
 * Uses IntersectionObserver (no scroll listeners → no jank).
 */
export default function StickyToday({
  recColor,
  recStr,
  recEmoji,
  coachOpener: _coachOpener,
  hrvStr,
  rhrStr,
  sleepEffStr,
  todayPlan,
  children,
}: Props) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const planFirstLine = todayPlan?.split("\n")[0] ?? null;

  return (
    <>
      {/* Sentinel: 1px div at top of card that triggers collapse when it leaves viewport */}
      <div ref={sentinelRef} style={{ height: 1, marginBottom: -1 }} />

      {/* Sticky compact strip — only visible once card has scrolled past */}
      {collapsed && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            padding: "0.5rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            fontSize: "0.85rem",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>{recEmoji}</span>
          <span
            className="mono metric-glow"
            style={{ fontWeight: 700, color: recColor, fontSize: "1.1rem" }}
          >
            {recStr}
          </span>
          <span style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>
            HRV {hrvStr} · RHR {rhrStr} · Sleep {sleepEffStr}
          </span>
          {planFirstLine && (
            <span
              style={{
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                marginLeft: "auto",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "10rem",
              }}
            >
              {planFirstLine}
            </span>
          )}
        </div>
      )}

      {/* Full hero card */}
      {children}
    </>
  );
}
