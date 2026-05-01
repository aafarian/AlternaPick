import type { StatCategory } from "@/lib/supabase/types";
import {
  NOTCH_TIERS,
  NOTCH_SHIFT_PCT,
  MIN_STEP,
  MIN_LINE,
  MIN_NOTCH,
  MAX_NOTCH,
  getHeatScoreMultiplier,
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
// Line adjustment (deferred to Phase 2 — notch tiers)
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
    if (baseLine + n * step < MIN_LINE) continue;
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
// Odds → probability (kept for future notch phase)
// ---------------------------------------------------------------------------

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

  return Math.max(0.01, Math.min(0.99, prob));
}

// ---------------------------------------------------------------------------
// HeatScore multiplier + Fire Token payout
// ---------------------------------------------------------------------------

export interface CardHeatScoreResult {
  /** Number of hits (scoreable picks that were correct). */
  hits: number;
  /** Effective card size: hits + misses (excludes DNP/push). */
  effectiveSize: number;
  /** The HeatScore multiplier (0x to 12x). */
  multiplier: number;
}

/**
 * Compute the HeatScore multiplier for a resolved card.
 *
 * HeatScore is a multiplier (0x to 12x) based on how many picks hit
 * relative to the effective card size. DNP and push picks are excluded.
 *
 * The multiplier is looked up from a balanced table where E[return] ≈ 0.70
 * at 50% hit rate for all card sizes, ensuring no card size is inherently
 * better or worse.
 */
export function computeCardHeatScore(
  hits: number,
  misses: number,
  dnpCount: number,
  cardSize: number,
): CardHeatScoreResult {
  const effectiveSize = hits + misses;

  if (effectiveSize === 0) {
    return { hits: 0, effectiveSize: 0, multiplier: 0 };
  }

  const multiplier = getHeatScoreMultiplier(
    hits,
    Math.min(effectiveSize, cardSize),
  );

  return { hits, effectiveSize, multiplier };
}

/**
 * Compute the Fire Token payout for a given wager and HeatScore multiplier.
 */
export function computeFireTokenPayout(
  wager: number,
  multiplier: number,
): number {
  return Math.round(wager * multiplier);
}
