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
  // Basketball — high-volume stats get lower pct (smaller relative shift)
  points: 0.08, // ~2pt shift on a 25-line, ~0.5 on a 5-line
  rebounds: 0.10, // ~1pt shift on a 10-line
  assists: 0.10, // ~0.5pt shift on a 6-line
  threes: 0.15, // ~0.5pt shift on a 3-line (higher pct because low volume)
  pra: 0.07, // ~2.5pt shift on a 35-line (lower pct — already composite)
  pts_reb: 0.08, // composite stat, similar to points
  pts_ast: 0.08, // composite stat, similar to points
  reb_ast: 0.10, // composite stat, mid-range volume
  blocks: 0.20, // ~0.5pt on a 2-line (high pct — very low volume, volatile)
  steals: 0.20, // ~0.5pt on a 2-line (same rationale as blocks)
  blk_stl: 0.15, // composite of two volatile stats
  turnovers: 0.15, // low volume, fairly volatile
  // Soccer — generally higher pct because stat lines are lower
  goals: 0.30, // ~0.5pt on a 1-line (very low volume, binary-ish)
  shots: 0.15, // ~0.5pt on a 3-line
  shots_on_target: 0.20, // ~0.5pt on a 2-line
  tackles: 0.15, // ~0.5pt on a 3-line
  passes: 0.08, // ~3pt on a 35-line (high volume like points)
  fouls_committed: 0.20, // ~0.5pt on a 2-line
  saves: 0.20, // ~0.5pt on a 2-line
};

/** Minimum shift per notch — ensures at least a 0.5 move. */
export const MIN_STEP = 0.5;

// ---------------------------------------------------------------------------
// HeatScore multiplier table
//
// HeatScore is a multiplier (0x to 12x) applied to the user's Fire Token
// wager. Payout = wager × HeatScore.
//
// The table is balanced so that E[return] ≈ 0.70 at a 50% per-pick hit
// rate for ALL card sizes. This means a coin-flip player loses ~30% per
// card on average, creating the refill loop. A skilled player hitting 60%+
// sustains or grows their token balance.
//
// 0 hits and 1 hit always return 0x (total loss of wager).
// Break-even falls at roughly 67% hits for every card size.
// ---------------------------------------------------------------------------

const HEATSCORE_TABLE: Record<number, Record<number, number>> = {
  2: { 2: 2.2, 1: 0.3, 0: 0 },
  3: { 3: 3.0, 2: 0.8, 1: 0.1, 0: 0 },
  4: { 4: 4.0, 3: 1.3, 2: 0.3, 1: 0.05, 0: 0 },
  5: { 5: 7.0, 4: 1.8, 3: 0.5, 2: 0.1, 1: 0, 0: 0 },
  6: { 6: 12.0, 5: 3.0, 4: 0.7, 3: 0.2, 2: 0.05, 1: 0, 0: 0 },
};

/**
 * Look up the HeatScore multiplier for a given effective card size and hit
 * count. Returns 0 for combinations not in the table.
 */
export function getHeatScoreMultiplier(
  hits: number,
  effectiveCardSize: number,
): number {
  return HEATSCORE_TABLE[effectiveCardSize]?.[hits] ?? 0;
}

// ---------------------------------------------------------------------------
// Fire Token economy constants
// ---------------------------------------------------------------------------

/** Starting Fire Token balance for new users. */
export const STARTING_BALANCE = 1000;

/** Minimum wager per card. */
export const MIN_WAGER = 10;

/** Weekly free token refill amount. */
export const WEEKLY_REFILL = 500;

/** Tokens earned per ad watched. */
export const AD_REFILL = 50;

/** Max ad refills per day. */
export const AD_REFILL_CAP = 3;

/** Bonus tokens for inviting a friend. */
export const INVITE_BONUS = 200;

/** Bonus tokens for challenging 3 different people in a week. */
export const CHALLENGE_WEEKLY_BONUS = 100;

// ---------------------------------------------------------------------------
// Misc constants
// ---------------------------------------------------------------------------

/** Minimum allowed adjusted line — can't go below this. */
export const MIN_LINE = 0.5;
