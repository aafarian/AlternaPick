import { describe, it, expect } from "vitest";
import {
  adjustLine,
  getAvailableNotches,
  selectionAllowedForNotch,
  impliedProbFromAmericanOdds,
  baseHeatScore,
  pickHeatScore,
  computeCardHeatScore,
  getNotchTier,
} from "../compute";

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

// ---------------------------------------------------------------------------
// adjustLine
// ---------------------------------------------------------------------------

describe("adjustLine", () => {
  it("returns the base line at notch 0", () => {
    expect(adjustLine(24.5, "points", 0)).toBe(24.5);
    expect(adjustLine(8.5, "rebounds", 0)).toBe(8.5);
  });

  it("shifts up for positive notch using stat step size", () => {
    // points step = 2.0
    expect(adjustLine(24.5, "points", 1)).toBe(26.5);
    expect(adjustLine(24.5, "points", 2)).toBe(28.5);
    expect(adjustLine(24.5, "points", 3)).toBe(30.5);
  });

  it("shifts down for negative notch", () => {
    // rebounds step = 1.0
    expect(adjustLine(8.5, "rebounds", -1)).toBe(7.5);
    expect(adjustLine(8.5, "rebounds", -2)).toBe(6.5);
  });

  it("floors at MIN_LINE (0.5)", () => {
    // blocks step = 0.5, line = 1.5, notch -2 → 1.5 - 1.0 = 0.5
    expect(adjustLine(1.5, "blocks", -2)).toBe(0.5);
    // blocks step = 0.5, line = 1.0, notch -2 → 1.0 - 1.0 = 0.0 → clamped to 0.5
    expect(adjustLine(1.0, "blocks", -2)).toBe(0.5);
  });

  it("clamps notch to valid range", () => {
    // notch 5 should be clamped to 3
    expect(adjustLine(10.5, "rebounds", 5)).toBe(adjustLine(10.5, "rebounds", 3));
    // notch -5 should be clamped to -2
    expect(adjustLine(10.5, "rebounds", -5)).toBe(adjustLine(10.5, "rebounds", -2));
  });

  it("handles soccer stats correctly", () => {
    // goals step = 0.5
    expect(adjustLine(0.5, "goals", 1)).toBe(1.0);
    expect(adjustLine(0.5, "goals", 3)).toBe(2.0);
    // passes step = 5.0
    expect(adjustLine(35, "passes", 1)).toBe(40);
  });

  it("handles half-step stats", () => {
    // threes step = 0.5
    expect(adjustLine(2.5, "threes", 1)).toBe(3.0);
    expect(adjustLine(2.5, "threes", -1)).toBe(2.0);
  });

  it("handles combo stats", () => {
    // pra step = 3.0
    expect(adjustLine(35.5, "pra", 2)).toBe(41.5);
    // reb_ast step = 1.5
    expect(adjustLine(10.5, "reb_ast", -1)).toBe(9.0);
  });
});

// ---------------------------------------------------------------------------
// getAvailableNotches
// ---------------------------------------------------------------------------

describe("getAvailableNotches", () => {
  it("returns all notches for a high line", () => {
    const notches = getAvailableNotches(24.5, "points");
    expect(notches).toEqual([-2, -1, 0, 1, 2, 3]);
  });

  it("restricts downward notches near the floor", () => {
    // blocks at 1.5, step 0.5: -2 → 0.5 (ok), -1 → 1.0 (ok), but if line=0.5:
    const notches = getAvailableNotches(0.5, "blocks");
    // -2 → 0.5 - 1.0 = -0.5 → below 0.5, excluded
    // -1 → 0.5 - 0.5 = 0.0 → below 0.5, excluded
    expect(notches).toEqual([0, 1, 2, 3]);
  });

  it("allows one downward notch when line is barely above floor", () => {
    // steals at 1.0, step 0.5: -1 → 0.5 (ok), -2 → 0.0 → excluded
    const notches = getAvailableNotches(1.0, "steals");
    expect(notches).toEqual([-1, 0, 1, 2, 3]);
  });

  it("handles goals at 0.5", () => {
    // goals step = 0.5, line = 0.5
    const notches = getAvailableNotches(0.5, "goals");
    expect(notches).toEqual([0, 1, 2, 3]);
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
    const prob = impliedProbFromAmericanOdds(-110);
    expect(prob).toBeCloseTo(0.524, 2);
  });

  it("handles positive odds (+150)", () => {
    const prob = impliedProbFromAmericanOdds(150);
    expect(prob).toBeCloseTo(0.4, 2);
  });

  it("handles heavy favorite (-200)", () => {
    const prob = impliedProbFromAmericanOdds(-200);
    expect(prob).toBeCloseTo(0.667, 2);
  });

  it("handles even money (+100)", () => {
    const prob = impliedProbFromAmericanOdds(100);
    expect(prob).toBeCloseTo(0.5, 2);
  });

  it("handles large underdog (+300)", () => {
    const prob = impliedProbFromAmericanOdds(300);
    expect(prob).toBeCloseTo(0.25, 2);
  });
});

// ---------------------------------------------------------------------------
// baseHeatScore
// ---------------------------------------------------------------------------

describe("baseHeatScore", () => {
  it("returns 100 at 50/50", () => {
    expect(baseHeatScore(0.5)).toBe(100);
  });

  it("returns lower score for favored picks", () => {
    // 75% → 100 * 0.25 / 0.75 = 33.33 → 33
    expect(baseHeatScore(0.75)).toBe(33);
  });

  it("returns higher score for underdog picks", () => {
    // 25% → 100 * 0.75 / 0.25 = 300
    expect(baseHeatScore(0.25)).toBe(300);
  });

  it("returns 100 for edge-case probabilities", () => {
    expect(baseHeatScore(0)).toBe(100);
    expect(baseHeatScore(1)).toBe(100);
  });

  it("handles typical -110 implied probability", () => {
    // ~52.4% → 100 * 0.476 / 0.524 ≈ 91
    const prob = impliedProbFromAmericanOdds(-110);
    expect(baseHeatScore(prob)).toBe(91);
  });
});

// ---------------------------------------------------------------------------
// pickHeatScore
// ---------------------------------------------------------------------------

describe("pickHeatScore", () => {
  it("returns base score at 1.0x multiplier", () => {
    expect(pickHeatScore(0.5, 1.0)).toBe(100);
  });

  it("applies Frosty multiplier (0.25x)", () => {
    expect(pickHeatScore(0.5, 0.25)).toBe(25);
  });

  it("applies Volcanic multiplier (4.0x)", () => {
    expect(pickHeatScore(0.5, 4.0)).toBe(400);
  });

  it("combines odds and multiplier", () => {
    // -200 odds → prob ≈ 0.667 → base ≈ 50, × 2.75 (Scorched) ≈ 138
    const prob = impliedProbFromAmericanOdds(-200);
    const base = baseHeatScore(prob);
    expect(pickHeatScore(prob, 2.75)).toBe(Math.round(base * 2.75));
  });
});

// ---------------------------------------------------------------------------
// computeCardHeatScore
// ---------------------------------------------------------------------------

describe("computeCardHeatScore", () => {
  it("computes a perfect 2-pick card (1.5x)", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
      ],
      2,
    );
    expect(result.netRaw).toBe(200);
    expect(result.multiplier).toBe(1.5);
    expect(result.final).toBe(300);
  });

  it("computes a 0-hit 3-pick card (1.5x penalty amplifier)", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: -100, result: "miss" },
        { heatScore: -100, result: "miss" },
        { heatScore: -100, result: "miss" },
      ],
      3,
    );
    expect(result.netRaw).toBe(-300);
    expect(result.multiplier).toBe(1.5);
    expect(result.final).toBe(-450);
  });

  it("computes a mixed 4-pick card (no multiplier for 2/4)", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: -100, result: "miss" },
        { heatScore: -100, result: "miss" },
      ],
      4,
    );
    expect(result.netRaw).toBe(0);
    expect(result.multiplier).toBe(1.0);
    expect(result.final).toBe(0);
  });

  it("computes a perfect 6-pick card (5.0x)", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 175, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 275, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 400, result: "hit" },
      ],
      6,
    );
    expect(result.netRaw).toBe(1150);
    expect(result.multiplier).toBe(5.0);
    expect(result.final).toBe(5750);
  });

  it("computes a 5/6 card (2.5x)", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: -100, result: "miss" },
      ],
      6,
    );
    expect(result.netRaw).toBe(400);
    expect(result.multiplier).toBe(2.5);
    expect(result.final).toBe(1000);
  });

  it("excludes DNP picks from sum and effective card size", () => {
    // 3-pick card with 1 DNP → effectively a 2-pick card
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 0, result: "dnp" },
      ],
      3,
    );
    // Effective size = 2, hits = 2 → perfect 2-pick → 1.5x
    expect(result.netRaw).toBe(200);
    expect(result.multiplier).toBe(1.5);
    expect(result.final).toBe(300);
  });

  it("excludes push picks from sum and effective card size", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: -100, result: "miss" },
        { heatScore: 0, result: "push" },
        { heatScore: 100, result: "hit" },
      ],
      4,
    );
    // Effective size = 3, hits = 2, misses = 1 → 3-pick with 2 hits → 1.0x
    expect(result.netRaw).toBe(100);
    expect(result.multiplier).toBe(1.0);
    expect(result.final).toBe(100);
  });

  it("returns 0 when all picks are DNP", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 0, result: "dnp" },
        { heatScore: 0, result: "dnp" },
      ],
      2,
    );
    expect(result.final).toBe(0);
  });

  it("handles a 4/5 card (2.0x)", () => {
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: -100, result: "miss" },
      ],
      5,
    );
    expect(result.netRaw).toBe(300);
    expect(result.multiplier).toBe(2.0);
    expect(result.final).toBe(600);
  });
});
