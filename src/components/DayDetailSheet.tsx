"use client";

import { useEffect, useRef, useState } from "react";

interface BiometricSnap {
  recovery?: {
    status?: string;
    score?: number | null;
    hrv_rmssd_ms?: number | null;
    rhr_bpm?: number | null;
  };
  sleep?: {
    efficiency_pct?: number;
    total_in_bed_min?: number;
  };
  cycle?: {
    strain?: number;
  };
}

interface DoneEntry {
  rpe?: number;
  rir?: number;
  soreness?: number;
  notes?: string;
}

interface PainEntry {
  area: string;
  severity: number;
  note: string;
  ts: string;
}

interface DayData {
  date: string;
  biometrics: BiometricSnap | null;
  done: DoneEntry | null;
  pain: PainEntry[];
  protein: boolean | null;
  bedtime: string | null;
  log: string[];
}

interface Props {
  date: string;
  onClose: () => void;
}

/**
 * Slide-up bottom sheet showing all data for a single day.
 * Opens via transform animation from bottom.
 * Dismisses on overlay tap, close button, or swipe-down.
 */
export default function DayDetailSheet({ date, onClose }: Props) {
  const [data, setData] = useState<DayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Touch-to-swipe-dismiss state
  const touchStartY = useRef<number | null>(null);
  const touchDeltaY = useRef<number>(0);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/day/${date}`)
      .then((r) => r.json())
      .then((d: DayData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [date]);

  // Slide-in animation
  useEffect(() => {
    // Defer one frame so CSS transition fires
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Lock body scroll while sheet is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function dismiss() {
    setVisible(false);
    setTimeout(onClose, 280); // wait for slide-out
  }

  // Swipe-down to dismiss
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  }

  function onTouchMove(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    touchDeltaY.current = delta;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }

  function onTouchEnd() {
    if (touchDeltaY.current > 80) {
      dismiss();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
    touchStartY.current = null;
    touchDeltaY.current = 0;
  }

  // Recovery color helper
  function recColor(score: number | null | undefined): string {
    if (score == null) return "var(--text-muted)";
    if (score >= 67) return "var(--green)";
    if (score >= 34) return "var(--yellow)";
    return "var(--red)";
  }

  const bio = data?.biometrics;
  const rec = bio?.recovery;
  const sleep = bio?.sleep;
  const cycle = bio?.cycle;

  return (
    <>
      {/* Overlay */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 100,
          opacity: visible ? 1 : 0,
          transition: "opacity 280ms ease",
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 101,
          background: "var(--bg-card)",
          borderRadius: "20px 20px 0 0",
          borderTop: "1px solid var(--border)",
          paddingBottom: "env(safe-area-inset-bottom)",
          maxHeight: "80vh",
          overflowY: "auto",
          overscrollBehavior: "contain",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.32,0.72,0,1)",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "0.75rem 0 0",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "4px",
              borderRadius: "2px",
              background: "var(--border)",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.75rem 1.25rem 0.25rem",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: "1rem",
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {date}
          </span>
          <button
            onClick={dismiss}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: "1.4rem",
              cursor: "pointer",
              padding: "0.25rem 0.5rem",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "0.75rem 1.25rem 1.5rem" }}>
          {loading && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                padding: "2rem 0",
                color: "var(--text-dim)",
                fontSize: "0.875rem",
              }}
            >
              Loading…
            </div>
          )}

          {!loading && !data && (
            <div style={{ color: "var(--text-dim)", fontSize: "0.875rem" }}>
              No data available
            </div>
          )}

          {!loading && data && (
            <>
              {/* Recovery */}
              {rec && rec.status === "scored" && (
                <Section title="Recovery">
                  <Row
                    label="Score"
                    value={
                      <span
                        className="mono metric-glow"
                        style={{
                          color: recColor(rec.score),
                          fontWeight: 700,
                        }}
                      >
                        {rec.score != null ? `${rec.score}%` : "—"}
                      </span>
                    }
                  />
                  {rec.hrv_rmssd_ms != null && (
                    <Row
                      label="HRV"
                      value={`${Math.round(rec.hrv_rmssd_ms)}ms`}
                    />
                  )}
                  {rec.rhr_bpm != null && (
                    <Row label="RHR" value={`${rec.rhr_bpm}bpm`} />
                  )}
                </Section>
              )}

              {/* Sleep */}
              {sleep && (
                <Section title="Sleep">
                  <Row
                    label="Efficiency"
                    value={`${Math.round(sleep.efficiency_pct ?? 0)}%`}
                  />
                  {sleep.total_in_bed_min != null && (
                    <Row
                      label="Duration"
                      value={`${Math.floor(sleep.total_in_bed_min / 60)}h${sleep.total_in_bed_min % 60}m`}
                    />
                  )}
                </Section>
              )}

              {/* Strain */}
              {cycle?.strain != null && (
                <Section title="Strain">
                  <Row label="Strain" value={cycle.strain.toFixed(1)} />
                </Section>
              )}

              {/* Workout feedback */}
              {data.done && (
                <Section title="Workout Feedback">
                  {data.done.rpe != null && (
                    <Row label="RPE" value={`${data.done.rpe}/10`} />
                  )}
                  {data.done.rir != null && (
                    <Row label="RIR" value={`${data.done.rir}`} />
                  )}
                  {data.done.soreness != null && (
                    <Row label="Soreness" value={`${data.done.soreness}/5`} />
                  )}
                  {data.done.notes && (
                    <div
                      style={{
                        marginTop: "0.4rem",
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      {data.done.notes}
                    </div>
                  )}
                </Section>
              )}

              {/* Protein */}
              {data.protein != null && (
                <Section title="Nutrition">
                  <Row
                    label="Protein target"
                    value={
                      <span
                        style={{
                          color: data.protein
                            ? "var(--green)"
                            : "var(--text-dim)",
                        }}
                      >
                        {data.protein ? "✓ Hit" : "✗ Missed"}
                      </span>
                    }
                  />
                </Section>
              )}

              {/* Bedtime */}
              {data.bedtime && (
                <Section title="Bedtime">
                  <Row label="Lights out" value={data.bedtime} />
                </Section>
              )}

              {/* Pain entries */}
              {data.pain && data.pain.length > 0 && (
                <Section title="Pain Log">
                  {data.pain.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "0.2rem 0",
                        fontSize: "0.85rem",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)" }}>
                        {p.area}
                      </span>
                      <span
                        style={{
                          color:
                            p.severity >= 4
                              ? "var(--red)"
                              : p.severity >= 2
                                ? "var(--yellow)"
                                : "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        {p.severity}/5
                      </span>
                    </div>
                  ))}
                </Section>
              )}

              {/* Daily log */}
              {data.log && data.log.length > 0 && (
                <Section title="Log">
                  {data.log.map((entry, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: "0.8rem",
                        color: "var(--text-muted)",
                        padding: "0.15rem 0",
                        borderBottom:
                          i < data.log.length - 1
                            ? "1px solid var(--border-muted)"
                            : "none",
                      }}
                    >
                      {entry}
                    </div>
                  ))}
                </Section>
              )}

              {/* Empty state */}
              {!rec &&
                !sleep &&
                !cycle?.strain &&
                !data.done &&
                data.protein == null &&
                !data.bedtime &&
                (!data.pain || data.pain.length === 0) &&
                (!data.log || data.log.length === 0) && (
                  <div
                    style={{
                      color: "var(--text-dim)",
                      fontSize: "0.875rem",
                      textAlign: "center",
                      padding: "1rem 0",
                    }}
                  >
                    No data recorded for this day
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div
        style={{
          fontSize: "0.65rem",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--text-dim)",
          fontWeight: 600,
          marginBottom: "0.35rem",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0.2rem 0",
        fontSize: "0.875rem",
      }}
    >
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600, color: "var(--text)" }}>{value}</span>
    </div>
  );
}
