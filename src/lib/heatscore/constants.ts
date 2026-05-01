import type { StatCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Notch tiers — the difficulty levels users can choose
// ---------------------------------------------------------------------------

export interface NotchTier {
  notch: number;
  label: string;
  multiplier: number;
  color: string;
}

export const NOTCH_TIERS: readonly NotchTier[] = [
  { notch: -2, label: "Frosty", multiplier: 0.25, color: "blue" },
  { notch: -1, label: "Chilled", multiplier: 0.5, color: "lightblue" },
  { notch: 0, label: "Standard", multiplier: 1.0, color: "neutral" },
  { notch: 1, label: "Heated", multiplier: 1.75, color: "orange" },
  { notch: 2, label: "Scorched", multiplier: 2.75, color: "red" },
  { notch: 3, label: "Volcanic", multiplier: 4.0, color: "purple" },
] as const;

export const MIN_NOTCH = -2;
export const MAX_NOTCH = 3;

// ---------------------------------------------------------------------------
// Line adjustment — percentage-based shift per notch
//
// Each notch shifts the line by a percentage of the base line, so a +1 notch
// on a 32.5-point line (~3.25 shift) is proportionally equivalent to +1 on a
// 4.5-point line (~0.45 shift). The result is snapped to the nearest 0.5
// increment (allowing both .0 and .5 values — pushes are handled as voids).
//
// A minimum step of 0.5 ensures low-line stats always shift by at least one
// half-point per notch.
// ---------------------------------------------------------------------------

/**
 * Percentage of the base line to shift per notch, per stat category.
 * Lower-variance stats use a smaller percentage; higher-variance stats
 * use a larger one.
 */
export const NOTCH_SHIFT_PCT: Record<StatCategory, number> = {
  // Basketball
  points: 0.08,
  rebounds: 0.10,
  assists: 0.10,
  threes: 0.15,
  pra: 0.07,
  pts_reb: 0.08,
  pts_ast: 0.08,
  reb_ast: 0.10,
  blocks: 0.20,
  steals: 0.20,
  blk_stl: 0.15,
  turnovers: 0.15,
  // Soccer
  goals: 0.30,
  shots: 0.15,
  shots_on_target: 0.20,
  tackles: 0.15,
  passes: 0.08,
  fouls_committed: 0.20,
  saves: 0.20,
};

/** Minimum shift per notch — ensures at least a 0.5 move. */
export const MIN_STEP = 0.5;

// ---------------------------------------------------------------------------
// Card-level multipliers — applied to net card score based on hit count
//
// Key: `${cardSize}-${hits}` → multiplier
// Missing entries default to 1.0 (no bonus/penalty).
// The 0-hit row amplifies losses (net score is negative, so 1.5× makes it
// more negative).
// ---------------------------------------------------------------------------

const CARD_MULTIPLIER_MAP: Record<string, number> = {
  // 2-pick
  "2-2": 1.5,
  "2-0": 1.5,
  // 3-pick
  "3-3": 2.0,
  "3-0": 1.5,
  // 4-pick
  "4-4": 3.0,
  "4-3": 1.5,
  "4-0": 1.5,
  // 5-pick
  "5-5": 4.0,
  "5-4": 2.0,
  "5-3": 1.25,
  "5-0": 1.5,
  // 6-pick
  "6-6": 5.0,
  "6-5": 2.5,
  "6-4": 1.5,
  "6-0": 1.5,
};

/**
 * Look up the card-level multiplier for a given effective card size and hit
 * count. Returns 1.0 (no multiplier) for combinations not in the table.
 */
export function getCardMultiplier(
  effectiveCardSize: number,
  hits: number,
): number {
  return CARD_MULTIPLIER_MAP[`${effectiveCardSize}-${hits}`] ?? 1.0;
}

// ---------------------------------------------------------------------------
// Misc constants
// ---------------------------------------------------------------------------

/** Minimum allowed adjusted line — can't go below this. */
export const MIN_LINE = 0.5;

/** Starting HeatScore balance for new users. */
export const STARTING_BALANCE = 1000;
