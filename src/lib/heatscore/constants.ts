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
  { notch: 1, label: "Heated", multiplier: 1.75, color: "yellow" },
  { notch: 2, label: "Scorched", multiplier: 2.75, color: "orange" },
  { notch: 3, label: "Volcanic", multiplier: 4.0, color: "red" },
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
  // Baseball
  hits: 0.20, // ~0.5pt on a 2-line (low volume)
  home_runs: 0.30, // ~0.5pt on a 0.5-line (very low volume, binary-ish)
  rbis: 0.20, // ~0.5pt on a 2-line
  runs: 0.20, // ~0.5pt on a 2-line
  stolen_bases: 0.30, // ~0.5pt on a 0.5-line (very low volume)
  total_bases: 0.15, // ~0.5pt on a 3-line
  pitcher_strikeouts: 0.12, // ~0.5pt on a 5-line
  pitcher_outs: 0.08, // ~1pt on a 15-line (high volume)
  hits_runs_rbis: 0.10, // composite, mid-range
};

/** Minimum shift per notch — ensures at least a 1-point move.
 * This prevents low-line stats (steals 0.5, blocks 1.5) from having
 * negligible half-point jumps between notch tiers. */
export const MIN_STEP = 1.0;

// ---------------------------------------------------------------------------
// HeatScore multiplier table
//
// HeatScore is a multiplier (0x to 8x) applied to the user's Flame Token
// wager. Payout = wager × HeatScore.
//
// The table is balanced so that E[return] ≈ 0.70 at a 50% per-pick hit
// rate for ALL card sizes. This means a coin-flip player loses ~30% per
// card on average, creating the refill loop. A skilled player hitting 60%+
// sustains or grows their token balance.
//
// Design philosophy: perfect cards should feel exciting (big payouts),
// majority-right cards (60%+) should be profitable, and below 50% should
// sting. More top-heavy than a flat curve, with real downside risk.
//
// Break-even hit rates: 100% (2-pick), ~67% (3-pick), ~63% (4-pick),
// ~60% (5-pick), ~58% (6-pick).
// ---------------------------------------------------------------------------

const HEATSCORE_TABLE: Record<number, Record<number, number>> = {
  2: { 2: 2.8, 1: 0, 0: 0 },
  3: { 3: 3.0, 2: 0.9, 1: 0, 0: 0 },
  4: { 4: 5.0, 3: 1.5, 2: 0, 1: 0, 0: 0 },
  5: { 5: 10.0, 4: 3, 3: 0.5, 2: 0, 1: 0, 0: 0 },
  6: { 6: 25.0, 5: 3.0, 4: 0.8, 3: 0, 2: 0, 1: 0, 0: 0 },
};

/**
 * Per-tier wager payout scale, calibrated so every notch tier has
 * E[return] ≈ 0.85 at its actual hit rate (50% for Standard).
 *
 * When a card mixes tiers, the geometric mean of the per-pick scales
 * is used — this prevents the exploit where one Volcanic pick inflates
 * the whole card's payout.
 */
export const WAGER_NOTCH_SCALE: Record<number, number> = {
  [-2]: 0.27,   // Frosty  — easy picks, low payout
  [-1]: 0.56,   // Chilled
  [0]:  1.0,    // Standard
  [1]:  4.36,   // Heated
  [2]:  14.68,  // Scorched
  [3]:  82.3,   // Volcanic — lottery ticket
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
// Hit quality bonus — flat token bonus/penalty based on margin
//
// How much the actual value exceeded (or fell short of) the line, as a
// ratio of the line. Bonus coins for hits that crushed the line, penalty
// for misses that weren't even close. Uses the line as denominator so
// it's naturally normalized across stat categories.
//
// These are ADDITIVE (flat coins), not multiplicative — they don't scale
// with the wager. This makes them meaningful but not dominant. A 100-token
// wager 4/6 card (1.2x = 120 payout) with good margins might get +20
// bonus tokens → 140 total. Final payout is floored at 0.
// ---------------------------------------------------------------------------

export interface QualityTier {
  /** Minimum margin ratio (inclusive) to qualify for this tier. */
  minMargin: number;
  /** Flat token bonus (positive) or penalty (negative) per pick. */
  tokens: number;
}

/** Bonus tokens for hits that beat the line by a wide margin.
 *
 * Tiers based on real margin distribution (1382 picks analyzed):
 *   0-5%: 6.5% of hits → barely beat, no bonus
 *   5-10%: 8.1% → slight edge
 *   10-20%: 25.7% → comfortable (biggest bucket, split at 15%)
 *   20-35%: 21.5% → solid
 *   35-50%: 11.7% → strong
 *   50-80%: 18.4% → crushed it (split at 65%)
 *   80%+: 8.1% → demolished
 */
export const HIT_QUALITY_TIERS: QualityTier[] = [
  { minMargin: 1.0, tokens: 45 },  // 100%+ — doubled the line or more
  { minMargin: 0.8, tokens: 38 },  // 80-100% — demolished
  { minMargin: 0.65, tokens: 30 }, // 65-80% — dominant
  { minMargin: 0.5, tokens: 25 },  // 50-65% — crushed it
  { minMargin: 0.35, tokens: 20 }, // 35-50% — strong beat
  { minMargin: 0.25, tokens: 15 }, // 25-35% — solid
  { minMargin: 0.15, tokens: 10 }, // 15-25% — comfortable
  { minMargin: 0.1, tokens: 6 },   // 10-15% — decent edge
  { minMargin: 0.05, tokens: 3 },  // 5-10% — slight edge
  { minMargin: 0, tokens: 0 },     // 0-5% — barely beat
];

/** Penalty tokens for misses. More tiers for finer differentiation.
 * Penalties are smaller than hit bonuses (asymmetric — reward > punish). */
export const MISS_QUALITY_TIERS: QualityTier[] = [
  { minMargin: 1.0, tokens: -30 },  // 100%+ — completely wrong
  { minMargin: 0.8, tokens: -25 },  // 80-100% — way off
  { minMargin: 0.65, tokens: -20 }, // 65-80% — bad miss
  { minMargin: 0.5, tokens: -15 },  // 50-65% — clear miss
  { minMargin: 0.35, tokens: -10 }, // 35-50% — noticeable miss
  { minMargin: 0.25, tokens: -8 },  // 25-35% — moderate miss
  { minMargin: 0.15, tokens: -5 },  // 15-25% — close-ish
  { minMargin: 0.1, tokens: -3 },   // 10-15% — close
  { minMargin: 0.05, tokens: -1 },  // 5-10% — very close
  { minMargin: 0, tokens: 0 },      // 0-5% — barely missed
];

// ---------------------------------------------------------------------------
// Flame Token economy constants
// ---------------------------------------------------------------------------

/** Starting Flame Token balance for new users. */
export const STARTING_BALANCE = 1000;

/** Minimum wager per card. */
export const MIN_WAGER = 10;

/** Daily login claim amount. */
export const DAILY_CLAIM = 50;

/**
 * Maximum number of "easy" notch picks (Frosty + Chilled) per card.
 * Set to 0 to disable the limit.
 *
 * Currently disabled: the calibrated WAGER_NOTCH_SCALE already penalizes
 * easy picks (Frosty = 0.27x payout), so the exploit is addressed by the
 * payout math rather than a hard cap. Re-enable if needed for game-feel.
 */
export const MAX_EASY_NOTCH_PICKS = 0; // disabled — allow unlimited Frosty/Chilled for testing

// ---------------------------------------------------------------------------
// Challenge token rewards (no wager — flat bonuses)
// ---------------------------------------------------------------------------

/** Tokens awarded to the winner of a challenge. */
export const CHALLENGE_WIN_BONUS = 25;

/** Tokens awarded to each player in a tied challenge. */
export const CHALLENGE_TIE_BONUS = 10;

// ---------------------------------------------------------------------------
// Misc constants
// ---------------------------------------------------------------------------

/** Minimum allowed adjusted line — can't go below this. */
export const MIN_LINE = 0.5;
