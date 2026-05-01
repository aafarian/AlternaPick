import type { StatCategory, PickResult } from "@/lib/supabase/types";
import {
  NOTCH_TIERS,
  NOTCH_SHIFT_PCT,
  MIN_STEP,
  MIN_LINE,
  MIN_NOTCH,
  MAX_NOTCH,
  getCardMultiplier,
} from "./constants";

// ---------------------------------------------------------------------------
// Notch tier lookup
// ---------------------------------------------------------------------------

const TIER_MAP = new Map(NOTCH_TIERS.map((t) => [t.notch, t]));

/**
 * Get the notch tier definition. Throws if `notch` is out of range.
 */
export function getNotchTier(notch: number) {
  const tier = TIER_MAP.get(notch);
  if (!tier) {
    throw new Error(
      `Invalid notch ${notch}. Must be between ${MIN_NOTCH} and ${MAX_NOTCH}.`,
    );
  }
  return tier;
}

// ---------------------------------------------------------------------------
// Line adjustment
// ---------------------------------------------------------------------------

/**
 * Compute the per-notch step size for a given line and stat category.
 *
 * The shift is percentage-based (`line × pct`), with a minimum of MIN_STEP
 * (0.5) to ensure every notch produces a meaningful change. The result is
 * snapped to the nearest 0.5 increment so adjusted lines are always on
 * clean half-point or whole-number boundaries.
 */
export function getStepSize(
  baseLine: number,
  statCategory: StatCategory,
): number {
  const pct = NOTCH_SHIFT_PCT[statCategory];
  const unsnapped = baseLine * pct;
  return Math.max(MIN_STEP, Math.round(unsnapped * 2) / 2);
}

/**
 * Compute the adjusted line after applying a notch shift.
 *
 * - Positive notch → line increases (harder over)
 * - Negative notch → line decreases (easier over)
 * - Shift is percentage-based and snapped to 0.5 increments
 * - Result is floored at `MIN_LINE` (0.5)
 * - Notch is clamped to [MIN_NOTCH, MAX_NOTCH]
 * - Adjusted lines may land on whole numbers — pushes are treated as voids
 */
export function adjustLine(
  baseLine: number,
  statCategory: StatCategory,
  notch: number,
): number {
  const clamped = Math.max(MIN_NOTCH, Math.min(MAX_NOTCH, notch));
  const step = getStepSize(baseLine, statCategory);
  const shifted = baseLine + clamped * step;
  return Math.max(MIN_LINE, shifted);
}

/**
 * Return the array of valid notch values for a given base line and stat,
 * respecting the MIN_LINE floor.
 *
 * A notch is excluded when it produces a duplicate adjusted line (meaning
 * the floor clamped it to the same value as a less-extreme notch) or when
 * the adjusted line would be below MIN_LINE before clamping.
 */
export function getAvailableNotches(
  baseLine: number,
  statCategory: StatCategory,
): number[] {
  const step = getStepSize(baseLine, statCategory);
  const notches: number[] = [];
  const seen = new Set<number>();
  for (let n = MIN_NOTCH; n <= MAX_NOTCH; n++) {
    const adjusted = adjustLine(baseLine, statCategory, n);
    // Exclude if the raw (pre-floor) shift drops below MIN_LINE
    if (baseLine + n * step < MIN_LINE) continue;
    // Exclude if this produces the same adjusted line as one already included
    if (n !== 0 && seen.has(adjusted)) continue;
    notches.push(n);
    seen.add(adjusted);
  }
  return notches;
}

/**
 * Which selections are allowed for a given notch.
 * Standard (0) allows both over and under.
 * Any shifted notch only allows over.
 */
export function selectionAllowedForNotch(
  notch: number,
): Array<"over" | "under"> {
  return notch === 0 ? ["over", "under"] : ["over"];
}

// ---------------------------------------------------------------------------
// Odds → probability → HeatScore
// ---------------------------------------------------------------------------

/** Maximum base HeatScore — prevents extreme outliers from game-breaking scores. */
const MAX_BASE_HS = 500;

/** Default probability used when odds are missing or degenerate. */
const DEFAULT_PROB = 0.5;

/**
 * Convert American odds to implied probability.
 *
 *   Negative odds (e.g. -110): prob = |odds| / (|odds| + 100)
 *   Positive odds (e.g. +150): prob = 100 / (odds + 100)
 *
 * Guards against degenerate inputs (NaN, Infinity, -100 which causes
 * division by zero). Returns a value clamped to [0.01, 0.99].
 */
export function impliedProbFromAmericanOdds(americanOdds: number): number {
  if (!Number.isFinite(americanOdds) || americanOdds === -100) {
    return DEFAULT_PROB;
  }

  let prob: number;
  if (americanOdds < 0) {
    prob = Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  } else {
    prob = 100 / (americanOdds + 100);
  }

  // Clamp to avoid edge-case 0 or 1 probabilities
  return Math.max(0.01, Math.min(0.99, prob));
}

/**
 * Base HeatScore from implied probability.
 * At 50/50 (prob = 0.5) this returns 100.
 * Lower probability → higher score (harder pick is worth more).
 * Capped at MAX_BASE_HS to prevent game-breaking outliers.
 */
export function baseHeatScore(impliedProb: number): number {
  if (impliedProb <= 0 || impliedProb >= 1) return 100;
  return Math.min(MAX_BASE_HS, Math.round((100 * (1 - impliedProb)) / impliedProb));
}

/**
 * HeatScore earned on a HIT — base score scaled by notch multiplier.
 * This is the variable "win" amount in the asymmetric scoring model.
 */
export function pickHeatScoreOnHit(
  impliedProb: number,
  notchMultiplier: number,
): number {
  return Math.round(baseHeatScore(impliedProb) * notchMultiplier);
}

/**
 * HeatScore lost on a MISS — fixed base (100) scaled by notch multiplier.
 * This is the fixed "risk" amount in the asymmetric scoring model.
 *
 * Why asymmetric: symmetric win/loss (same amount for hit and miss) creates
 * positive EV for favorites and negative EV for underdogs. By fixing the
 * loss at 100 × notchMultiplier, the EV is ~0 regardless of odds:
 *
 *   EV = prob × winHS - (1 - prob) × lossHS
 *      = prob × (base × mult) - (1 - prob) × (100 × mult)
 *      = mult × [prob × base - (1 - prob) × 100]
 *      = mult × [prob × 100×(1-p)/p - (1-p) × 100]
 *      = mult × [100×(1-p) - 100×(1-p)]
 *      = 0
 */
export function pickHeatScoreOnMiss(notchMultiplier: number): number {
  return Math.round(100 * notchMultiplier);
}

// ---------------------------------------------------------------------------
// Card-level HeatScore
// ---------------------------------------------------------------------------

/** Input for a single pick when computing the card-level score. */
export interface CardPickInput {
  /**
   * Signed HeatScore for this pick:
   * - Hit picks: positive value from `pickHeatScoreOnHit`
   * - Miss picks: negative value from `-pickHeatScoreOnMiss`
   * - DNP/push picks: 0 (excluded from scoring)
   */
  heatScore: number;
  result: PickResult;
}

/**
 * Compute the final card-level HeatScore.
 *
 * 1. Sum signed per-pick scores (hit = +, miss = -).
 *    DNP and push picks are excluded from the sum AND from the effective
 *    card size used to look up the multiplier.
 * 2. Look up the card multiplier based on effective card size and hit count.
 * 3. Return Math.round(netRaw × multiplier).
 */
export function computeCardHeatScore(
  picks: CardPickInput[],
  cardSize: number,
): { netRaw: number; multiplier: number; final: number } {
  const scoreable = picks.filter(
    (p) => p.result === "hit" || p.result === "miss",
  );

  const effectiveSize = scoreable.length;
  if (effectiveSize === 0) {
    return { netRaw: 0, multiplier: 1, final: 0 };
  }

  const hits = scoreable.filter((p) => p.result === "hit").length;
  const netRaw = scoreable.reduce((sum, p) => sum + p.heatScore, 0);
  const multiplier = getCardMultiplier(
    // Use effective size so DNP doesn't inflate the multiplier tier.
    Math.min(effectiveSize, cardSize),
    hits,
  );

  return {
    netRaw,
    multiplier,
    final: Math.round(netRaw * multiplier),
  };
}
