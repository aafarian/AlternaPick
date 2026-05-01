import { describe, it, expect } from "vitest";
import {
  adjustLine,
  getStepSize,
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
// getStepSize
// ---------------------------------------------------------------------------

describe("getStepSize", () => {
  it("computes percentage-based step for high-line stats", () => {
    // points at 30.0, pct = 0.08: raw = 2.4, snapped to 2.5
    expect(getStepSize(30.0, "points")).toBe(2.5);
  });

  it("computes percentage-based step for low-line stats", () => {
    // points at 4.5, pct = 0.08: raw = 0.36, snapped to 0.5 (min step)
    expect(getStepSize(4.5, "points")).toBe(0.5);
  });

  it("enforces minimum step of 0.5", () => {
    // rebounds at 2.5, pct = 0.10: raw = 0.25, below min → 0.5
    expect(getStepSize(2.5, "rebounds")).toBe(0.5);
  });

  it("snaps to nearest 0.5", () => {
    // rebounds at 8.5, pct = 0.10: raw = 0.85, snaps to 1.0
    expect(getStepSize(8.5, "rebounds")).toBe(1.0);
    // rebounds at 12.5, pct = 0.10: raw = 1.25, snaps to 1.5
    expect(getStepSize(12.5, "rebounds")).toBe(1.5);
  });

  it("scales proportionally for high-volume scorers", () => {
    // points at 32.5, pct = 0.08: raw = 2.6, snaps to 2.5
    expect(getStepSize(32.5, "points")).toBe(2.5);
    // points at 10.5, pct = 0.08: raw = 0.84, snaps to 1.0
    expect(getStepSize(10.5, "points")).toBe(1.0);
  });

  it("handles soccer stats", () => {
    // goals at 0.5, pct = 0.30: raw = 0.15, min → 0.5
    expect(getStepSize(0.5, "goals")).toBe(0.5);
    // passes at 35.0, pct = 0.08: raw = 2.8, snaps to 3.0
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
    // points at 24.5, step = max(0.5, round(24.5*0.08*2)/2) = round(3.92)/2 = 2.0
    const step = getStepSize(24.5, "points");
    expect(adjustLine(24.5, "points", 1)).toBe(24.5 + step);
    expect(adjustLine(24.5, "points", 2)).toBe(24.5 + step * 2);
  });

  it("shifts down for negative notch", () => {
    const step = getStepSize(8.5, "rebounds");
    expect(adjustLine(8.5, "rebounds", -1)).toBe(8.5 - step);
  });

  it("floors at MIN_LINE (0.5)", () => {
    // Very low line with big negative notch should floor at 0.5
    expect(adjustLine(1.0, "blocks", -2)).toBe(0.5);
  });

  it("clamps notch to valid range", () => {
    expect(adjustLine(10.5, "rebounds", 5)).toBe(adjustLine(10.5, "rebounds", 3));
    expect(adjustLine(10.5, "rebounds", -5)).toBe(adjustLine(10.5, "rebounds", -2));
  });

  it("produces proportional shifts for different baselines", () => {
    // A star at 32.5 points: step should be ~2.5
    const starStep = getStepSize(32.5, "points");
    // A role player at 4.5 points: step should be ~0.5
    const roleStep = getStepSize(4.5, "points");

    // Star shift is proportionally similar to role player shift
    expect(starStep / 32.5).toBeCloseTo(roleStep / 4.5, 0);
    // But absolute shift is much larger for the star
    expect(starStep).toBeGreaterThan(roleStep);
  });

  it("can produce whole-number adjusted lines", () => {
    // rebounds at 8.5, step = 1.0, notch +1 → 9.5 (.5 value)
    // rebounds at 8.5, step = 1.0, notch -1 → 7.5 (.5 value)
    // But points at 24.5, step = 2.0, notch +1 → 26.5 (.5 value)
    // points at 25.0, step = 2.0, notch +1 → 27.0 (whole number!)
    expect(adjustLine(25.0, "points", 1) % 1).toBe(0); // whole number
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
    // blocks at 0.5, step = 0.5: can't go lower
    const notches = getAvailableNotches(0.5, "blocks");
    expect(notches).toEqual([0, 1, 2, 3]);
  });

  it("allows one downward notch when line is barely above floor", () => {
    // steals at 1.0, step = 0.5: -1 → 0.5 (ok), -2 → 0.0 → excluded
    const notches = getAvailableNotches(1.0, "steals");
    expect(notches).toEqual([-1, 0, 1, 2, 3]);
  });

  it("handles goals at 0.5", () => {
    const notches = getAvailableNotches(0.5, "goals");
    expect(notches).toEqual([0, 1, 2, 3]);
  });

  it("always includes notch 0", () => {
    const notches = getAvailableNotches(0.5, "blocks");
    expect(notches).toContain(0);
  });

  it("filters duplicate adjusted lines near floor", () => {
    // If two negative notches both produce MIN_LINE due to floor clamping,
    // only the one closest to 0 should be included
    const notches = getAvailableNotches(0.5, "steals");
    // step = 0.5, -1 → 0.0 (excluded), -2 → -0.5 (excluded)
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
    expect(baseHeatScore(0.75)).toBe(33);
  });

  it("returns higher score for underdog picks", () => {
    expect(baseHeatScore(0.25)).toBe(300);
  });

  it("returns 100 for edge-case probabilities", () => {
    expect(baseHeatScore(0)).toBe(100);
    expect(baseHeatScore(1)).toBe(100);
  });

  it("handles typical -110 implied probability", () => {
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
    const result = computeCardHeatScore(
      [
        { heatScore: 100, result: "hit" },
        { heatScore: 100, result: "hit" },
        { heatScore: 0, result: "dnp" },
      ],
      3,
    );
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
