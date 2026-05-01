import { describe, it, expect } from "vitest";
import {
  adjustLine,
  getStepSize,
  getAvailableNotches,
  selectionAllowedForNotch,
  impliedProbFromAmericanOdds,
  computeCardHeatScore,
  computeFireTokenPayout,
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
    expect(getStepSize(4.5, "points")).toBe(0.5);
  });

  it("enforces minimum step of 0.5", () => {
    expect(getStepSize(2.5, "rebounds")).toBe(0.5);
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
    expect(getStepSize(0.5, "goals")).toBe(0.5);
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

  it("allows one downward notch when line is barely above floor", () => {
    const notches = getAvailableNotches(1.0, "steals");
    expect(notches).toEqual([-1, 0, 1, 2, 3]);
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
    expect(getHeatScoreMultiplier(2, 2)).toBe(2.2);
    expect(getHeatScoreMultiplier(1, 2)).toBe(0.3);
    expect(getHeatScoreMultiplier(0, 2)).toBe(0);
  });

  it("returns correct multiplier for every cell of 3-pick table", () => {
    expect(getHeatScoreMultiplier(3, 3)).toBe(3.0);
    expect(getHeatScoreMultiplier(2, 3)).toBe(0.8);
    expect(getHeatScoreMultiplier(1, 3)).toBe(0.1);
    expect(getHeatScoreMultiplier(0, 3)).toBe(0);
  });

  it("returns correct multiplier for every cell of 4-pick table", () => {
    expect(getHeatScoreMultiplier(4, 4)).toBe(4.0);
    expect(getHeatScoreMultiplier(3, 4)).toBe(1.3);
    expect(getHeatScoreMultiplier(2, 4)).toBe(0.3);
    expect(getHeatScoreMultiplier(1, 4)).toBe(0.05);
    expect(getHeatScoreMultiplier(0, 4)).toBe(0);
  });

  it("returns correct multiplier for every cell of 5-pick table", () => {
    expect(getHeatScoreMultiplier(5, 5)).toBe(7.0);
    expect(getHeatScoreMultiplier(4, 5)).toBe(1.8);
    expect(getHeatScoreMultiplier(3, 5)).toBe(0.5);
    expect(getHeatScoreMultiplier(2, 5)).toBe(0.1);
    expect(getHeatScoreMultiplier(1, 5)).toBe(0);
    expect(getHeatScoreMultiplier(0, 5)).toBe(0);
  });

  it("returns correct multiplier for every cell of 6-pick table", () => {
    expect(getHeatScoreMultiplier(6, 6)).toBe(12.0);
    expect(getHeatScoreMultiplier(5, 6)).toBe(3.0);
    expect(getHeatScoreMultiplier(4, 6)).toBe(0.7);
    expect(getHeatScoreMultiplier(3, 6)).toBe(0.2);
    expect(getHeatScoreMultiplier(2, 6)).toBe(0.05);
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
    const result = computeCardHeatScore(2, 0, 0, 2);
    expect(result.hits).toBe(2);
    expect(result.effectiveSize).toBe(2);
    expect(result.multiplier).toBe(2.2);
  });

  it("computes a perfect 6-pick card", () => {
    const result = computeCardHeatScore(6, 0, 0, 6);
    expect(result.multiplier).toBe(12.0);
  });

  it("computes a 4/6 card", () => {
    const result = computeCardHeatScore(4, 2, 0, 6);
    expect(result.effectiveSize).toBe(6);
    expect(result.multiplier).toBe(0.7);
  });

  it("computes a 0-hit card as 0x (total wager loss)", () => {
    const result = computeCardHeatScore(0, 3, 0, 3);
    expect(result.multiplier).toBe(0);
  });

  it("excludes DNP from effective card size", () => {
    // 3-pick card with 1 DNP → effectively 2-pick
    const result = computeCardHeatScore(2, 0, 1, 3);
    expect(result.effectiveSize).toBe(2);
    expect(result.multiplier).toBe(2.2); // Perfect 2-pick = 2.2x
  });

  it("returns 0 multiplier when all picks are DNP", () => {
    const result = computeCardHeatScore(0, 0, 3, 3);
    expect(result.effectiveSize).toBe(0);
    expect(result.multiplier).toBe(0);
  });

  it("handles 5/6 card", () => {
    const result = computeCardHeatScore(5, 1, 0, 6);
    expect(result.multiplier).toBe(3.0);
  });

  it("handles 1-hit cards as 0x across all sizes", () => {
    expect(computeCardHeatScore(1, 1, 0, 2).multiplier).toBe(0.3);
    expect(computeCardHeatScore(1, 2, 0, 3).multiplier).toBe(0.1);
    expect(computeCardHeatScore(1, 3, 0, 4).multiplier).toBe(0.05);
    expect(computeCardHeatScore(1, 4, 0, 5).multiplier).toBe(0);
    expect(computeCardHeatScore(1, 5, 0, 6).multiplier).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// computeFireTokenPayout
// ---------------------------------------------------------------------------

describe("computeFireTokenPayout", () => {
  it("multiplies wager by multiplier", () => {
    expect(computeFireTokenPayout(100, 2.2)).toBe(220);
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
    expect(computeFireTokenPayout(250, 12.0)).toBe(3000);
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
    expect(expectedReturn(2, 0.5)).toBeCloseTo(0.70, 1);
  });

  it("3-pick card has E[return] ≈ 0.70 at 50% hit rate", () => {
    expect(expectedReturn(3, 0.5)).toBeCloseTo(0.70, 1);
  });

  it("4-pick card has E[return] ≈ 0.70 at 50% hit rate", () => {
    expect(expectedReturn(4, 0.5)).toBeCloseTo(0.70, 1);
  });

  it("5-pick card has E[return] ≈ 0.70 at 50% hit rate", () => {
    expect(expectedReturn(5, 0.5)).toBeCloseTo(0.70, 1);
  });

  it("6-pick card has E[return] ≈ 0.70 at 50% hit rate", () => {
    expect(expectedReturn(6, 0.5)).toBeCloseTo(0.70, 1);
  });

  it("all card sizes have the same E[return] within tolerance", () => {
    const evs = [2, 3, 4, 5, 6].map((size) => expectedReturn(size, 0.5));
    const min = Math.min(...evs);
    const max = Math.max(...evs);
    // All within 0.05 of each other
    expect(max - min).toBeLessThan(0.05);
  });
});
