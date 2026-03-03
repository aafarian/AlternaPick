/**
 * Helper utilities for OG image generation.
 *
 * These are pure functions that format data for display inside
 * @vercel/og ImageResponse JSX (Satori).
 */

import type { GameMode, StatCategory } from "@/lib/supabase/types";
import { CATEGORY_LABELS } from "@/lib/constants";
import { GAME_MODES } from "@/lib/modes/definitions";

// ---- OG Image color constants ----

/** Shared color palette for @vercel/og ImageResponse routes. */
export const OG_COLORS = {
  /** Page / card background */
  bg: "#09090b",
  /** Slightly lighter surface for cards */
  surface: "#18181b",
  /** Muted border */
  border: "#27272a",
  /** Primary brand green */
  green: "#22c55e",
  /** Danger / miss red */
  red: "#ef4444",
  /** Amber for pending / in-progress */
  amber: "#f59e0b",
  /** Electric blue accent */
  blue: "#3b82f6",
  /** Purple accent */
  purple: "#a855f7",
  /** Primary text */
  text: "#fafafa",
  /** Secondary / muted text */
  muted: "#a1a1aa",
} as const;

// ---- Score formatting ----

/**
 * Format a score as "X/Y" for display in OG images.
 */
export function formatScore(score: number, total: number): string {
  return `${score}/${total}`;
}

/**
 * Compute hit-rate percentage (0-100) rounded to the nearest integer.
 */
export function hitRatePercent(score: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((score / total) * 100);
}

// ---- Result display ----

/** Unicode checkmark for hit picks */
export const HIT_ICON = "\u2713";
/** Unicode cross for miss picks */
export const MISS_ICON = "\u2717";
/** Question mark for pending picks */
export const PENDING_ICON = "?";

/**
 * Return the appropriate result icon for a pick result.
 */
export function resultIcon(result: string): string {
  if (result === "hit") return HIT_ICON;
  if (result === "miss") return MISS_ICON;
  if (result === "dnp" || result === "push") return "\u2014";
  return PENDING_ICON;
}

// ---- Stat category labels ----

/**
 * Return a display-friendly label for a stat category.
 */
export function statLabel(category: string): string {
  return (
    CATEGORY_LABELS[category as StatCategory] ?? category
  );
}

// ---- Game mode labels ----

/**
 * Return the display name for a game mode (e.g. "Classic", "Sabotage").
 */
export function modeLabel(mode: GameMode): string {
  return GAME_MODES[mode]?.displayName ?? mode;
}

/**
 * Return the emoji icon for a game mode.
 */
export function modeIcon(mode: GameMode): string {
  return GAME_MODES[mode]?.icon ?? "";
}

/**
 * Return combined "icon name" string for a mode badge.
 */
export function modeBadgeText(mode: GameMode): string {
  const icon = modeIcon(mode);
  const label = modeLabel(mode);
  return icon ? `${icon} ${label}` : label;
}

// ---- Direction label ----

/**
 * Return "OVER" or "UNDER" for a pick selection.
 */
export function directionLabel(selection: string): string {
  return selection === "over" ? "OVER" : "UNDER";
}
