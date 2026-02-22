import type { IconShape, EmblemId, EmblemMeta } from "./types";

/* ---------- Shapes ---------- */

export const SHAPES: readonly IconShape[] = [
  "circle",
  "shield",
  "hexagon",
  "diamond",
  "square",
] as const;

/* ---------- Emblems ---------- */

export const EMBLEMS: readonly EmblemMeta[] = [
  // Animals
  { id: "lion", label: "Lion", category: "animals" },
  { id: "eagle", label: "Eagle", category: "animals" },
  { id: "wolf", label: "Wolf", category: "animals" },
  { id: "bear", label: "Bear", category: "animals" },
  { id: "hawk", label: "Hawk", category: "animals" },
  { id: "snake", label: "Snake", category: "animals" },
  { id: "dragon", label: "Dragon", category: "animals" },
  // Sports
  { id: "basketball", label: "Basketball", category: "sports" },
  { id: "football", label: "Football", category: "sports" },
  { id: "baseball", label: "Baseball", category: "sports" },
  { id: "soccer", label: "Soccer", category: "sports" },
  { id: "trophy", label: "Trophy", category: "sports" },
  { id: "lightning", label: "Lightning", category: "sports" },
  { id: "flame", label: "Flame", category: "sports" },
  // Symbols
  { id: "star", label: "Star", category: "symbols" },
  { id: "crown", label: "Crown", category: "symbols" },
  { id: "sword", label: "Sword", category: "symbols" },
  { id: "shield-emblem", label: "Shield", category: "symbols" },
  { id: "bolt", label: "Bolt", category: "symbols" },
] as const;

/** Set of all valid emblem IDs for runtime validation */
export const EMBLEM_IDS: readonly EmblemId[] = EMBLEMS.map((e) => e.id);

/* ---------- Color Palettes ---------- */

/**
 * Curated background colors — deep, saturated tones that work well
 * as icon backgrounds. All hex strings.
 */
export const BG_COLORS: readonly string[] = [
  "#1a1a2e", // midnight navy
  "#16213e", // deep blue
  "#0f3460", // royal blue
  "#1b1b3a", // dark indigo
  "#2d132c", // deep plum
  "#4a0e4e", // dark purple
  "#1a3c34", // forest green
  "#0b3d2e", // emerald dark
  "#3d0c02", // deep crimson
  "#4a1c1c", // dark maroon
  "#2e2e2e", // charcoal
  "#1c1c3c", // space blue
  "#1e3a1e", // hunter green
  "#3b1f2b", // burgundy
] as const;

/**
 * Curated border colors — bright, vibrant accents that contrast
 * well against the dark background colors.
 */
export const BORDER_COLORS: readonly string[] = [
  "#e94560", // hot red
  "#0ea5e9", // sky blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#8b5cf6", // violet
  "#14b8a6", // teal
  "#ef4444", // red
  "#eab308", // yellow
  "#6366f1", // indigo
  "#84cc16", // lime
] as const;

/**
 * Curated emblem colors — bright, high-contrast colors that remain
 * visible against dark backgrounds.
 */
export const EMBLEM_COLORS: readonly string[] = [
  "#ffffff", // white
  "#f8fafc", // off-white
  "#e94560", // hot red
  "#0ea5e9", // sky blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#eab308", // yellow
  "#14b8a6", // teal
  "#fbbf24", // gold
  "#c084fc", // lavender
] as const;
