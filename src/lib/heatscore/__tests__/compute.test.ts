import { describe, it, expect } from "vitest";
import {
  adjustLine,
  getStepSize,
  getAvailableNotches,
  selectionAllowedForNotch,
  impliedProbFromAmericanOdds,
  computeCardHeatScore,
  computeFireTokenPayout,
  pickMarginRatio,
  qualityTokens,
  computeQualityBonus,
  getNotchTier,
} from "../compute";
import { NOTCH_TIERS, getHeatScoreMultiplier } from "../constants";

// ---------------------------------------------------------------------------
// getNotchTier
// ---------------------------------------------------------------------------

describe("getNotchTier", () => {
  it("returns the correct tier for each valid notch", () => {
    expect(getNotchTier(-2).label).toBe("Frosty");
    expect(getNotchTier(-1).label).toBe("Chilled");
    expect(getNotchTier(0).label).toBe("Standard");
    expect(getNotchTier(1).label).toBe("Heated");
    expect(getNotchTier(2).label).toBe("Scorched");
    expect(getNotchTier(3).label).toBe("Volcanic");
  });

  it("throws for out-of-range notch", () => {
    expect(() => getNotchTier(4)).toThrow("Invalid notch 4");
    expect(() => getNotchTier(-3)).toThrow("Invalid notch -3");
  });
});

describe("NOTCH_TIERS ordering", () => {
  it("has multipliers in ascending order", () => {
    for (let i = 1; i < NOTCH_TIERS.length; i++) {
      expect(NOTCH_TIERS[i].multiplier).toBeGreaterThan(
        NOTCH_TIERS[i - 1].multiplier,
      );
    }
  });

  it("has notch values in ascending order", () => {
    for (let i = 1; i < NOTCH_TIERS.length; i++) {
      expect(NOTCH_TIERS[i].notch).toBeGreaterThan(NOTCH_TIERS[i - 1].notch);
    }
  });
});

// ---------------------------------------------------------------------------
// getStepSize
// ---------------------------------------------------------------------------

describe("getStepSize", () => {
  it("computes percentage-based step for high-line stats", () => {
    expect(getStepSize(30.0, "points")).toBe(2.5);
  });

  it("computes percentage-based step for low-line stats", () => {
    // points at 4.5, pct = 0.08: raw = 0.36, below MIN_STEP → 1.0
    expect(getStepSize(4.5, "points")).toBe(1.0);
  });

  it("enforces minimum step of 1.0", () => {
    expect(getStepSize(2.5, "rebounds")).toBe(1.0);
  });

  it("snaps to nearest 0.5", () => {
    expect(getStepSize(8.5, "rebounds")).toBe(1.0);
    expect(getStepSize(12.5, "rebounds")).toBe(1.5);
  });

  it("scales proportionally for different baselines", () => {
    const starStep = getStepSize(32.5, "points");
    const roleStep = getStepSize(4.5, "points");
    expect(starStep).toBeGreaterThan(roleStep);
  });

  it("handles soccer stats", () => {
    // goals at 0.5: raw = 0.15, below MIN_STEP → 1.0
    expect(getStepSize(0.5, "goals")).toBe(1.0);
    expect(getStepSize(35.0, "passes")).toBe(3.0);
  });
});

// ---------------------------------------------------------------------------
// adjustLine
// ---------------------------------------------------------------------------

describe("adjustLine", () => {
  it("returns the base line at notch 0", () => {
    expect(adjustLine(24.5, "points", 0)).toBe(24.5);
    expect(adjustLine(8.5, "rebounds", 0)).toBe(8.5);
  });

  it("shifts up proportionally for positive notch", () => {
    const step = getStepSize(24.5, "points");
    expect(adjustLine(24.5, "points", 1)).toBe(24.5 + step);
    expect(adjustLine(24.5, "points", 2)).toBe(24.5 + step * 2);
  });

  it("shifts down for negative notch", () => {
    const step = getStepSize(8.5, "rebounds");
    expect(adjustLine(8.5, "rebounds", -1)).toBe(8.5 - step);
  });

  it("floors at MIN_LINE (0.5)", () => {
    expect(adjustLine(1.0, "blocks", -2)).toBe(0.5);
  });

  it("clamps notch to valid range", () => {
    expect(adjustLine(10.5, "rebounds", 5)).toBe(
      adjustLine(10.5, "rebounds", 3),
    );
    expect(adjustLine(10.5, "rebounds", -5)).toBe(
      adjustLine(10.5, "rebounds", -2),
    );
  });

  it("can produce whole-number adjusted lines", () => {
    expect(adjustLine(25.0, "points", 1) % 1).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getAvailableNotches
// ---------------------------------------------------------------------------

describe("getAvailableNotches", () => {
  it("returns all notches for a high line", () => {
    expect(getAvailableNotches(24.5, "points")).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it("restricts downward notches near the floor", () => {
    const notches = getAvailableNotches(0.5, "blocks");
    expect(notches).toEqual([0, 1, 2, 3]);
  });

  it("restricts downward notches when step exceeds line minus floor", () => {
    // steals at 1.0, step = 1.0: -1 → 0.0 (below 0.5), excluded
    const notches = getAvailableNotches(1.0, "steals");
    expect(notches).toEqual([0, 1, 2, 3]);
  });

  it("always includes notch 0", () => {
    expect(getAvailableNotches(0.5, "blocks")).toContain(0);
  });

  it("uses adjustLine internally for consistency", () => {
    const notches = getAvailableNotches(2.0, "blocks");
    for (const n of notches) {
      expect(adjustLine(2.0, "blocks", n)).toBeGreaterThanOrEqual(0.5);
    }
  });
});

// ---------------------------------------------------------------------------
// selectionAllowedForNotch
// ---------------------------------------------------------------------------

describe("selectionAllowedForNotch", () => {
  it("allows both over and under at notch 0", () => {
    expect(selectionAllowedForNotch(0)).toEqual(["over", "under"]);
  });

  it("allows only over for positive notches", () => {
    expect(selectionAllowedForNotch(1)).toEqual(["over"]);
    expect(selectionAllowedForNotch(3)).toEqual(["over"]);
  });

  it("allows only over for negative notches", () => {
    expect(selectionAllowedForNotch(-1)).toEqual(["over"]);
    expect(selectionAllowedForNotch(-2)).toEqual(["over"]);
  });
});

// ---------------------------------------------------------------------------
// impliedProbFromAmericanOdds
// ---------------------------------------------------------------------------

describe("impliedProbFromAmericanOdds", () => {
  it("handles standard -110 line", () => {
    expect(impliedProbFromAmericanOdds(-110)).toBeCloseTo(0.524, 2);
  });

  it("handles positive odds (+150)", () => {
    expect(impliedProbFromAmericanOdds(150)).toBeCloseTo(0.4, 2);
  });

  it("handles heavy favorite (-200)", () => {
    expect(impliedProbFromAmericanOdds(-200)).toBeCloseTo(0.667, 2);
  });

  it("handles even money (+100)", () => {
    expect(impliedProbFromAmericanOdds(100)).toBeCloseTo(0.5, 2);
  });

  it("handles large underdog (+300)", () => {
    expect(impliedProbFromAmericanOdds(300)).toBeCloseTo(0.25, 2);
  });

  it("returns default for NaN", () => {
    expect(impliedProbFromAmericanOdds(NaN)).toBe(0.5);
  });

  it("returns default for Infinity", () => {
    expect(impliedProbFromAmericanOdds(Infinity)).toBe(0.5);
  });

  it("returns default for -100 (division by zero)", () => {
    expect(impliedProbFromAmericanOdds(-100)).toBe(0.5);
  });

  it("clamps very large odds", () => {
    expect(impliedProbFromAmericanOdds(-10000)).toBe(0.99);
    expect(impliedProbFromAmericanOdds(50000)).toBe(0.01);
  });
});

// ---------------------------------------------------------------------------
// getHeatScoreMultiplier
// ---------------------------------------------------------------------------

describe("getHeatScoreMultiplier", () => {
  it("returns correct multiplier for every cell of 2-pick table", () => {
    expect(getHeatScoreMultiplier(2, 2)).toBe(2.8);
    expect(getHeatScoreMultiplier(1, 2)).toBe(0);
    expect(getHeatScoreMultiplier(0, 2)).toBe(0);
  });

  it("returns correct multiplier for every cell of 3-pick table", () => {
    expect(getHeatScoreMultiplier(3, 3)).toBe(3.0);
    expect(getHeatScoreMultiplier(2, 3)).toBe(0.9);
    expect(getHeatScoreMultiplier(1, 3)).toBe(0);
    expect(getHeatScoreMultiplier(0, 3)).toBe(0);
  });

  it("returns correct multiplier for every cell of 4-pick table", () => {
    expect(getHeatScoreMultiplier(4, 4)).toBe(5.0);
    expect(getHeatScoreMultiplier(3, 4)).toBe(1.5);
    expect(getHeatScoreMultiplier(2, 4)).toBe(0);
    expect(getHeatScoreMultiplier(1, 4)).toBe(0);
    expect(getHeatScoreMultiplier(0, 4)).toBe(0);
  });

  it("returns correct multiplier for every cell of 5-pick table", () => {
    expect(getHeatScoreMultiplier(5, 5)).toBe(10.0);
    expect(getHeatScoreMultiplier(4, 5)).toBe(1.8);
    expect(getHeatScoreMultiplier(3, 5)).toBe(0.4);
    expect(getHeatScoreMultiplier(2, 5)).toBe(0);
    expect(getHeatScoreMultiplier(1, 5)).toBe(0);
    expect(getHeatScoreMultiplier(0, 5)).toBe(0);
  });

  it("returns correct multiplier for every cell of 6-pick table", () => {
    expect(getHeatScoreMultiplier(6, 6)).toBe(25.0);
    expect(getHeatScoreMultiplier(5, 6)).toBe(2.0);
    expect(getHeatScoreMultiplier(4, 6)).toBe(0.5);
    expect(getHeatScoreMultiplier(3, 6)).toBe(0);
    expect(getHeatScoreMultiplier(2, 6)).toBe(0);
    expect(getHeatScoreMultiplier(1, 6)).toBe(0);
    expect(getHeatScoreMultiplier(0, 6)).toBe(0);
  });

  it("returns 0 for card sizes not in the table", () => {
    expect(getHeatScoreMultiplier(1, 1)).toBe(0);
    expect(getHeatScoreMultiplier(7, 7)).toBe(0);
  });

  it("returns 0 for more hits than effective size", () => {
    expect(getHeatScoreMultiplier(3, 2)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeCardHeatScore
// ---------------------------------------------------------------------------

describe("computeCardHeatScore", () => {
  it("computes a perfect 2-pick card", () => {
    const result = computeCardHeatScore(2, 0, 2);
    expect(result.hits).toBe(2);
    expect(result.effectiveSize).toBe(2);
    expect(result.multiplier).toBe(2.8);
  });

  it("computes a perfect 6-pick card", () => {
    const result = computeCardHeatScore(6, 0, 6);
    expect(result.multiplier).toBe(25.0);
  });

  it("computes a 4/6 card", () => {
    const result = computeCardHeatScore(4, 2, 6);
    expect(result.effectiveSize).toBe(6);
    expect(result.multiplier).toBe(0.5);
  });

  it("computes a 0-hit card as 0x (total wager loss)", () => {
    const result = computeCardHeatScore(0, 3, 3);
    expect(result.multiplier).toBe(0);
  });

  it("excludes DNP from effective card size", () => {
    // 3-pick card with 1 DNP → effectively 2-pick
    const result = computeCardHeatScore(2, 0, 3);
    expect(result.effectiveSize).toBe(2);
    expect(result.multiplier).toBe(2.8); // Perfect 2-pick = 2.8x
  });

  it("returns 0 multiplier when all picks are DNP", () => {
    const result = computeCardHeatScore(0, 0, 3);
    expect(result.effectiveSize).toBe(0);
    expect(result.multiplier).toBe(0);
  });

  it("handles 5/6 card", () => {
    const result = computeCardHeatScore(5, 1, 6);
    expect(result.multiplier).toBe(2.0);
  });

  it("returns 0x for unsupported 1-pick cards", () => {
    const result = computeCardHeatScore(1, 0, 1);
    expect(result.multiplier).toBe(0);
  });

  it("returns 0x for unsupported 7-pick cards", () => {
    const result = computeCardHeatScore(7, 0, 7);
    expect(result.multiplier).toBe(0);
  });

  it("handles ≤50% hit cards as bust across all sizes", () => {
    expect(computeCardHeatScore(1, 1, 2).multiplier).toBe(0);  // 1/2 = 50% = bust
    expect(computeCardHeatScore(1, 2, 3).multiplier).toBe(0);  // 1/3 = 33% = bust
    expect(computeCardHeatScore(1, 3, 4).multiplier).toBe(0);  // 1/4 = 25% = bust
    expect(computeCardHeatScore(2, 4, 6).multiplier).toBe(0);  // 2/6 = 33% = bust
    expect(computeCardHeatScore(3, 3, 6).multiplier).toBe(0);  // 3/6 = 50% = bust
  });
});

// ---------------------------------------------------------------------------
// computeFireTokenPayout
// ---------------------------------------------------------------------------

describe("computeFireTokenPayout", () => {
  it("multiplies wager by multiplier", () => {
    expect(computeFireTokenPayout(100, 2.8)).toBe(280);
  });

  it("returns 0 for 0x multiplier", () => {
    expect(computeFireTokenPayout(100, 0)).toBe(0);
  });

  it("returns 0 for 0 wager", () => {
    expect(computeFireTokenPayout(0, 12.0)).toBe(0);
  });

  it("rounds to nearest integer", () => {
    expect(computeFireTokenPayout(100, 0.3)).toBe(30);
    expect(computeFireTokenPayout(75, 0.7)).toBe(53); // 52.5 → 53
  });

  it("handles perfect 6-pick with large wager", () => {
    expect(computeFireTokenPayout(250, 25.0)).toBe(6250);
  });

  it("adds quality bonus to payout", () => {
    expect(computeFireTokenPayout(100, 1.2, 20)).toBe(140);
  });

  it("subtracts quality penalty from payout", () => {
    expect(computeFireTokenPayout(100, 0.25, -15)).toBe(10);
  });

  it("floors payout at 0 when quality penalty exceeds base", () => {
    expect(computeFireTokenPayout(100, 0.25, -50)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// EV verification — expected return ≈ 0.70 at 50% hit rate for all card sizes
// ---------------------------------------------------------------------------

describe("EV balance verification", () => {
  function binomialCoeff(n: number, k: number): number {
    if (k > n) return 0;
    if (k === 0 || k === n) return 1;
    let result = 1;
    for (let i = 0; i < k; i++) {
      result = (result * (n - i)) / (i + 1);
    }
    return result;
  }

  function expectedReturn(cardSize: number, hitRate: number): number {
    let ev = 0;
    for (let k = 0; k <= cardSize; k++) {
      const prob = binomialCoeff(cardSize, k) * Math.pow(hitRate, k) * Math.pow(1 - hitRate, cardSize - k);
      const multiplier = getHeatScoreMultiplier(k, cardSize);
      ev += prob * multiplier;
    }
    return ev;
  }

  it("2-pick card has E[return] ≈ 0.70 at 50% hit rate", () => {
    expect(expectedReturn(2, 0.5)).toBeCloseTo(0.70, 2);
  });

  it("3-pick card has E[return] ≈ 0.71 at 50% hit rate", () => {
    expect(expectedReturn(3, 0.5)).toBeCloseTo(0.71, 2);
  });

  it("4-pick card has E[return] ≈ 0.69 at 50% hit rate", () => {
    expect(expectedReturn(4, 0.5)).toBeCloseTo(0.69, 2);
  });

  it("5-pick card has E[return] ≈ 0.72 at 50% hit rate", () => {
    expect(expectedReturn(5, 0.5)).toBeCloseTo(0.72, 2);
  });

  it("6-pick card has E[return] ≈ 0.70 at 50% hit rate", () => {
    expect(expectedReturn(6, 0.5)).toBeCloseTo(0.70, 2);
  });

  it("all card sizes have the same E[return] within tolerance", () => {
    const evs = [2, 3, 4, 5, 6].map((size) => expectedReturn(size, 0.5));
    const min = Math.min(...evs);
    const max = Math.max(...evs);
    // All within 0.05 of each other
    expect(max - min).toBeLessThan(0.05);
  });
});

// ---------------------------------------------------------------------------
// pickMarginRatio
// ---------------------------------------------------------------------------

describe("pickMarginRatio", () => {
  it("computes positive margin for over hit", () => {
    // Over 22.5, scored 30 → (30 - 22.5) / 22.5 = 0.333
    expect(pickMarginRatio(30, 22.5, "over")).toBeCloseTo(0.333, 2);
  });

  it("computes negative margin for over miss", () => {
    // Over 22.5, scored 15 → (15 - 22.5) / 22.5 = -0.333
    expect(pickMarginRatio(15, 22.5, "over")).toBeCloseTo(-0.333, 2);
  });

  it("computes positive margin for under hit", () => {
    // Under 22.5, scored 15 → (22.5 - 15) / 22.5 = 0.333
    expect(pickMarginRatio(15, 22.5, "under")).toBeCloseTo(0.333, 2);
  });

  it("computes negative margin for under miss", () => {
    // Under 22.5, scored 30 → (22.5 - 30) / 22.5 = -0.333
    expect(pickMarginRatio(30, 22.5, "under")).toBeCloseTo(-0.333, 2);
  });

  it("returns 0 for exact hit on the line", () => {
    expect(pickMarginRatio(22.5, 22.5, "over")).toBe(0);
  });

  it("handles doubled line (100% margin)", () => {
    // Over 22.5, scored 45 → (45 - 22.5) / 22.5 = 1.0
    expect(pickMarginRatio(45, 22.5, "over")).toBe(1.0);
  });

  it("returns 0 for line of 0", () => {
    expect(pickMarginRatio(5, 0, "over")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// qualityTokens
// ---------------------------------------------------------------------------

describe("qualityTokens", () => {
  it("returns 0 for barely beat (0-10% margin)", () => {
    expect(qualityTokens(0.05)).toBe(0);
  });

  it("returns +3 for 10-25% margin hit", () => {
    expect(qualityTokens(0.15)).toBe(3);
  });

  it("returns +8 for 25-50% margin hit", () => {
    expect(qualityTokens(0.35)).toBe(8);
  });

  it("returns +15 for 50-100% margin hit", () => {
    expect(qualityTokens(0.75)).toBe(15);
  });

  it("returns +25 for 100%+ margin hit (demolished)", () => {
    expect(qualityTokens(1.5)).toBe(25);
  });

  it("returns -3 for 10-25% margin miss", () => {
    expect(qualityTokens(-0.15)).toBe(-3);
  });

  it("returns -25 for 100%+ margin miss (blowout)", () => {
    expect(qualityTokens(-1.5)).toBe(-25);
  });

  it("returns 0 for barely missed (0-10%)", () => {
    expect(qualityTokens(-0.05)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeQualityBonus
// ---------------------------------------------------------------------------

describe("computeQualityBonus", () => {
  it("sums bonuses for multiple hits", () => {
    const result = computeQualityBonus([
      { actualValue: 30, line: 22.5, selection: "over", result: "hit" },   // 33% → +8
      { actualValue: 45, line: 22.5, selection: "over", result: "hit" },   // 100% → +25
    ]);
    expect(result.total).toBe(33);
    expect(result.perPick).toEqual([8, 25]);
  });

  it("sums penalties for misses", () => {
    const result = computeQualityBonus([
      { actualValue: 3, line: 22.5, selection: "over", result: "miss" },   // -87% → -15
      { actualValue: 20, line: 22.5, selection: "over", result: "miss" },  // -11% → -3
    ]);
    expect(result.total).toBe(-18);
    expect(result.perPick).toEqual([-15, -3]);
  });

  it("excludes DNP/push picks", () => {
    const result = computeQualityBonus([
      { actualValue: 45, line: 22.5, selection: "over", result: "hit" },
      { actualValue: null, line: 22.5, selection: "over", result: "dnp" },
      { actualValue: null, line: 8.5, selection: "under", result: "push" },
    ]);
    expect(result.total).toBe(25);
    expect(result.perPick).toEqual([25, 0, 0]);
  });

  it("nets hits and misses together", () => {
    const result = computeQualityBonus([
      { actualValue: 45, line: 22.5, selection: "over", result: "hit" },   // 100% → +25
      { actualValue: 3, line: 22.5, selection: "over", result: "miss" },   // -87% → -15
    ]);
    expect(result.total).toBe(10); // +25 - 15
  });
});
