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
  { id: "lion", label: "Lion" },
  { id: "eagle", label: "Eagle" },
  { id: "wolf", label: "Wolf" },
  { id: "bear", label: "Bear" },
  { id: "hawk", label: "Hawk" },
  { id: "snake", label: "Snake" },
  { id: "dragon", label: "Dragon" },
  { id: "paw", label: "Paw" },
  { id: "basketball", label: "Basketball" },
  { id: "football", label: "Football" },
  { id: "baseball", label: "Baseball" },
  { id: "soccer", label: "Soccer" },
  { id: "trophy", label: "Trophy" },
  { id: "lightning", label: "Lightning" },
  { id: "flame", label: "Flame" },
  { id: "star", label: "Star" },
  { id: "crown", label: "Crown" },
  { id: "sword", label: "Sword" },
  { id: "shield-emblem", label: "Shield" },
  { id: "bolt", label: "Bolt" },
  { id: "mountain", label: "Mountain" },
  { id: "anchor", label: "Anchor" },
  { id: "rocket", label: "Rocket" },
  { id: "gem", label: "Gem" },
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
