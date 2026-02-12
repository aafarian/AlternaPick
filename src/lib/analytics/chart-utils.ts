"use client";

import { useRef, useState, useEffect } from "react";

/** Shared chart color constants (hex for SVG fill/stroke) */
export const CHART_COLORS = {
  green: "#00d26a",
  blue: "#3b82f6",
  red: "#ef4444",
  muted: "#6b7280",
  surface: "#1e1e2e",
} as const;

/** Return a color based on hit rate percentage: green (60%+), blue (40-59%), red (<40%) */
export function rateColor(pct: number): string {
  if (pct >= 60) return CHART_COLORS.green;
  if (pct >= 40) return CHART_COLORS.blue;
  return CHART_COLORS.red;
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
