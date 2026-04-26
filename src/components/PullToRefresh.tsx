"use client";
import { useEffect, useRef } from "react";

export default function PullToRefresh() {
  const startY = useRef(0);
  const pulling = useRef(false);
  const indicator = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onStart(e: TouchEvent) {
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    }
    function onMove(e: TouchEvent) {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && indicator.current) {
        const visible = Math.min(dy / 80, 1);
        indicator.current.style.opacity = String(visible);
        indicator.current.style.transform = `translateY(${Math.min(dy, 80)}px) rotate(${dy * 4}deg)`;
      }
    }
    function onEnd(e: TouchEvent) {
      if (!pulling.current) return;
      const dy = e.changedTouches[0].clientY - startY.current;
      if (dy > 80) window.location.reload();
      else if (indicator.current) {
        indicator.current.style.opacity = "0";
        indicator.current.style.transform = "translateY(0)";
      }
      pulling.current = false;
    }
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  return (
    <div
      ref={indicator}
      style={{
        position: "fixed",
        top: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        border: "3px solid var(--primary)",
        borderTopColor: "transparent",
        opacity: 0,
        pointerEvents: "none",
        zIndex: 100,
        transition: "opacity 200ms",
      }}
    />
  );
}
