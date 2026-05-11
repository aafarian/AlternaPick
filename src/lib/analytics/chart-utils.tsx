"use client";

import { useRef, useState, useEffect } from "react";
import { SPORT_CONFIG, UI_SPORTS } from "@/lib/sports";

/** Shared chart color constants (hex for SVG fill/stroke) */
export const CHART_COLORS = {
  green: "#00d26a",
  blue: "#3b82f6",
  red: "#ef4444",
  purple: "#a78bfa",
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

/** Orange color for flame token charts */
export const FLAME_ORANGE = "#f97316";

/** Map stat categories to their sport's short label, derived from SPORT_CONFIG. */
const CATEGORY_SPORT_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const key of UI_SPORTS) {
    const config = SPORT_CONFIG[key];
    for (const c of config.categories) {
      if (c.value !== "all" && !map[c.value]) {
        map[c.value] = config.shortLabel;
      }
    }
  }
  return map;
})();

/** Get a stat category's sport label (e.g. "points" → "NBA", "hits" → "MLB") */
export function getCategorySport(cat: string): string | null {
  return CATEGORY_SPORT_MAP[cat] ?? null;
}

/** Shared wrapper class for analytics chart sections — gradient bg, subtle shadow, no border. */
export const CHART_SECTION_CLASS = "h-full rounded-2xl bg-gradient-to-b from-white/[0.04] to-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)]";

/** Shared title class for chart section headings. */
export const CHART_TITLE_CLASS = "mb-4 text-sm font-bold uppercase tracking-widest text-muted-foreground";

/** Format a Date to a locale-aware hour string (e.g. "3 PM") */
export function formatHour(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: "numeric", hour12: true });
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
