"use client";

import { useRef, useState, useEffect } from "react";

/** Shared chart color constants (hex for SVG fill/stroke) */
export const CHART_COLORS = {
  green: "#00d26a",
  blue: "#3b82f6",
  red: "#ef4444",
  muted: "#6b7280",
  surface: "#1e1e2e",
  text: "#e5e5e5",
} as const;

/** Return a color based on hit rate percentage: green (60%+), blue (40-59%), red (<40%) */
export function rateColor(pct: number): string {
  if (pct >= 60) return CHART_COLORS.green;
  if (pct >= 40) return CHART_COLORS.blue;
  return CHART_COLORS.red;
}

/** SVG gradient ID used by all horizontal bar charts */
export const BAR_GRADIENT_ID = "barGradient";

/** Render an SVG <defs> block containing the shared bar gradient (primary → accent) */
export function BarGradientDef() {
  return (
    <defs>
      <linearGradient id={BAR_GRADIENT_ID} x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={CHART_COLORS.green} />
        <stop offset="100%" stopColor={CHART_COLORS.blue} />
      </linearGradient>
    </defs>
  );
}

/** Reusable hook: tracks an element's width via ResizeObserver for responsive SVG charts */
export function useResponsiveWidth() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { containerRef, width };
}
