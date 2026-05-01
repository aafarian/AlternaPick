import type { StatCategory, PickResult } from "@/lib/supabase/types";
import {
  NOTCH_TIERS,
  STAT_STEP_SIZES,
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
 * Compute the adjusted line after applying a notch shift.
 *
 * - Positive notch → line increases (harder over)
 * - Negative notch → line decreases (easier over)
 * - Result is floored at `MIN_LINE` (0.5)
 * - Notch is clamped to [MIN_NOTCH, MAX_NOTCH]
 */
export function adjustLine(
  baseLine: number,
  statCategory: StatCategory,
  notch: number,
): number {
  const clamped = Math.max(MIN_NOTCH, Math.min(MAX_NOTCH, notch));
  const step = STAT_STEP_SIZES[statCategory];
  const shifted = baseLine + clamped * step;
  return Math.max(MIN_LINE, shifted);
}

/**
 * Return the array of valid notch values for a given base line and stat,
 * respecting the MIN_LINE floor.
 *
 * A notch is excluded when the raw (unclamped) shift would drop the line
 * below MIN_LINE — i.e., the floor would override the intended shift and
 * the user wouldn't actually get a different line from a less-negative notch.
 */
export function getAvailableNotches(
  baseLine: number,
  statCategory: StatCategory,
): number[] {
  const step = STAT_STEP_SIZES[statCategory];
  const notches: number[] = [];
  for (let n = MIN_NOTCH; n <= MAX_NOTCH; n++) {
    const raw = baseLine + n * step;
    if (raw >= MIN_LINE) {
      notches.push(n);
    }
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

/**
 * Convert American odds to implied probability.
 *
 *   Negative odds (e.g. -110): prob = |odds| / (|odds| + 100)
 *   Positive odds (e.g. +150): prob = 100 / (odds + 100)
 *
 * Returns a value between 0 and 1 (exclusive).
 */
export function impliedProbFromAmericanOdds(americanOdds: number): number {
  if (americanOdds < 0) {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
  return 100 / (americanOdds + 100);
}

/**
 * Base HeatScore from implied probability.
 * At 50/50 (prob = 0.5) this returns 100.
 * Lower probability → higher score (harder pick is worth more).
 */
export function baseHeatScore(impliedProb: number): number {
  if (impliedProb <= 0 || impliedProb >= 1) return 100;
  return Math.round((100 * (1 - impliedProb)) / impliedProb);
}

/**
 * Per-pick HeatScore: base score scaled by notch multiplier.
 */
export function pickHeatScore(
  impliedProb: number,
  notchMultiplier: number,
): number {
  return Math.round(baseHeatScore(impliedProb) * notchMultiplier);
}

// ---------------------------------------------------------------------------
// Card-level HeatScore
// ---------------------------------------------------------------------------

/** Input for a single pick when computing the card-level score. */
export interface CardPickInput {
  /** Signed HeatScore for this pick (+HS on hit, -HS on miss). */
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
    // Use actual effective size, not original cardSize, so DNP doesn't
    // inflate the multiplier tier.
    Math.min(effectiveSize, cardSize),
    hits,
  );

  return {
    netRaw,
    multiplier,
    final: Math.round(netRaw * multiplier),
  };
}
