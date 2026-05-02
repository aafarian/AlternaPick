import type { StatCategory } from "@/lib/supabase/types";
import {
  NOTCH_TIERS,
  NOTCH_SHIFT_PCT,
  MIN_STEP,
  MIN_LINE,
  MIN_NOTCH,
  MAX_NOTCH,
  getHeatScoreMultiplier,
  HIT_QUALITY_TIERS,
  MISS_QUALITY_TIERS,
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
 * (1.0) to ensure every notch produces a meaningful change. The result is
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
// HeatScore multiplier + Flame Token payout
// ---------------------------------------------------------------------------

export interface CardHeatScoreResult {
  /** Number of hits (scoreable picks that were correct). */
  hits: number;
  /** Effective card size: hits + misses (excludes DNP/push). */
  effectiveSize: number;
  /** The HeatScore multiplier (0x to 25x). */
  multiplier: number;
}

/**
 * Compute the HeatScore multiplier for a resolved card.
 *
 * HeatScore is a multiplier (0x to 12x) based on how many picks hit
 * relative to the effective card size. DNP and push picks are excluded —
 * only pass hits and misses (not DNP/push counts).
 *
 * The multiplier is looked up from a balanced table where E[return] ≈ 0.70
 * at 50% hit rate for all card sizes, ensuring no card size is inherently
 * better or worse.
 */
export function computeCardHeatScore(
  hits: number,
  misses: number,
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

// ---------------------------------------------------------------------------
// HeatScore — per-pick additive scoring (challenges + casual)
//
// No multiplier table, no bust threshold, no card-level cliffs.
// Each pick earns/loses points independently based on:
//   1. Hit or miss (base points)
//   2. Notch difficulty (scales base)
//   3. Quality margin (how much you beat/missed the line by)
//
// This is used for comparing players' card quality. It's NOT used
// for Wager Flame token payouts (those use the multiplier table).
// ---------------------------------------------------------------------------

/** Base points for a correct pick. Scaled by notch multiplier.
 * Hit = +130 × notchMult. Standard hit = +130, Volcanic hit = +520. */
const HEATSCORE_HIT_BASE = 130;

/** Input for a single pick when computing challenge HeatScore. */
export interface HeatScorePickInput {
  result: "hit" | "miss" | "push" | "dnp" | "pending";
  notchMultiplier: number;
  /** Quality tokens for this pick (already notch-amplified). */
  qualityTokens: number;
}

/**
 * Compute per-pick additive HeatScore for a card.
 *
 * Formula per scoreable pick:
 *   hit:  +(HEATSCORE_HIT_BASE × notchMultiplier) + qualityTokens
 *   miss: qualityTokens only (negative quality = penalty for bad miss)
 *
 * DNP/push picks contribute 0.
 *
 * Misses have NO flat penalty — they're just missed opportunities.
 * The only penalty comes from quality (negative tokens for bad margins).
 * This means:
 *   - Same hits = same HeatScore regardless of card size
 *   - Bold picks (Volcanic) are rewarded per hit, not extra-punished per miss
 *   - Frosty 6/6 (204) < Standard 4/6 (552) — easy perfect loses to real hits
 *   - Volcanic 3/6 (1860) > Standard 4/6 (552) — hard hits dominate
 */
export function computeHeatScore(picks: HeatScorePickInput[]): number {
  let total = 0;

  for (const pick of picks) {
    if (pick.result === "hit") {
      total += Math.round(HEATSCORE_HIT_BASE * pick.notchMultiplier) + pick.qualityTokens;
    } else if (pick.result === "miss") {
      total += pick.qualityTokens; // quality penalty only (negative tokens for bad margins)
    }
    // DNP/push: 0 contribution
  }

  return total;
}

/**
 * Compute the Flame Token payout for a given wager and HeatScore multiplier.
 * Includes an optional quality bonus (from hit/miss margins). Floored at 0.
 */
export function computeFireTokenPayout(
  wager: number,
  multiplier: number,
  qualityBonus?: number,
): number {
  return Math.max(0, Math.round(wager * multiplier + (qualityBonus ?? 0)));
}

// ---------------------------------------------------------------------------
// Hit quality bonus — rewards/penalizes based on margin
// ---------------------------------------------------------------------------

/**
 * Minimum denominator for margin ratio calculation.
 * Prevents low-line stats (0.5 threes, 1.5 blocks) from producing
 * extreme margin ratios. Missing 0.5 by 0.5 should NOT be a 100%
 * margin — it's barely a miss. With a floor of 5, that becomes 10%.
 */
const MARGIN_DENOM_FLOOR = 5;

/**
 * Compute the margin ratio for a single pick.
 * Positive = beat the line, negative = missed the line.
 * Uses max(line, MARGIN_DENOM_FLOOR) as denominator so low-line stats
 * don't produce disproportionate quality bonuses/penalties.
 */
export function pickMarginRatio(
  actualValue: number,
  line: number,
  selection: "over" | "under",
): number {
  if (line === 0) return 0;
  const denom = Math.max(line, MARGIN_DENOM_FLOOR);
  if (selection === "over") {
    return (actualValue - line) / denom;
  }
  return (line - actualValue) / denom;
}

/**
 * Look up the flat token bonus/penalty for a given margin ratio.
 * Positive margin (hit) uses HIT_QUALITY_TIERS, negative (miss) uses
 * MISS_QUALITY_TIERS.
 */
export function qualityTokens(marginRatio: number): number {
  const isHit = marginRatio >= 0;
  const absMargin = Math.abs(marginRatio);
  const tiers = isHit ? HIT_QUALITY_TIERS : MISS_QUALITY_TIERS;

  for (const tier of tiers) {
    if (absMargin >= tier.minMargin) {
      return tier.tokens;
    }
  }
  return 0;
}

/** Input for computing quality bonus across a card's picks. */
export interface QualityPickInput {
  actualValue: number | null;
  line: number;
  selection: "over" | "under";
  result: "hit" | "miss" | "push" | "dnp" | "pending";
  /** Notch tier multiplier (1.0 for Standard, up to 4.0 for Volcanic). Amplifies quality tokens. */
  notchMultiplier?: number;
}

/**
 * Compute the total quality bonus (flat tokens) for a card.
 * Sums per-pick bonuses for hits and penalties for misses.
 * DNP/push picks are excluded.
 *
 * When a pick has a notchMultiplier > 1.0, the quality tokens for
 * that pick are amplified — rewarding bold play when it pays off,
 * and penalizing it when it doesn't.
 */
export function computeQualityBonus(picks: QualityPickInput[]): {
  total: number;
  perPick: number[];
} {
  const perPick: number[] = [];
  let total = 0;

  for (const pick of picks) {
    if (
      pick.actualValue === null ||
      (pick.result !== "hit" && pick.result !== "miss")
    ) {
      perPick.push(0);
      continue;
    }

    const margin = pickMarginRatio(pick.actualValue, pick.line, pick.selection);
    const baseTokens = qualityTokens(margin);
    const amplified = Math.round(baseTokens * (pick.notchMultiplier ?? 1));
    perPick.push(amplified);
    total += amplified;
  }

  return { total, perPick };
}
