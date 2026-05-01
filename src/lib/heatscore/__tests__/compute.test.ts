import { describe, it, expect } from "vitest";
import {
  adjustLine,
  getStepSize,
  getAvailableNotches,
  selectionAllowedForNotch,
  impliedProbFromAmericanOdds,
  baseHeatScore,
  pickHeatScoreOnHit,
  pickHeatScoreOnMiss,
  computeCardHeatScore,
  getNotchTier,
} from "../compute";
import { NOTCH_TIERS } from "../constants";

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
    // points at 30.0, pct = 0.08: raw = 2.4, snapped to 2.5
    expect(getStepSize(30.0, "points")).toBe(2.5);
  });

  it("computes percentage-based step for low-line stats", () => {
    // points at 4.5, pct = 0.08: raw = 0.36, snapped to 0.5 (min step)
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
    // This verifies pushes are possible with adjusted lines
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
    // Every returned notch should produce a line >= 0.5 via adjustLine
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

  // Edge cases
  it("returns default for NaN", () => {
    expect(impliedProbFromAmericanOdds(NaN)).toBe(0.5);
  });

  it("returns default for Infinity", () => {
    expect(impliedProbFromAmericanOdds(Infinity)).toBe(0.5);
  });

  it("returns default for -100 (division by zero)", () => {
    expect(impliedProbFromAmericanOdds(-100)).toBe(0.5);
  });

  it("clamps very large odds to 0.99 max probability", () => {
    // -10000 → prob = 10000/10100 = 0.99009... → clamped to 0.99
    expect(impliedProbFromAmericanOdds(-10000)).toBe(0.99);
  });

  it("clamps very large positive odds to 0.01 min probability", () => {
    // +50000 → prob = 100/50100 = 0.002 → clamped to 0.01
    expect(impliedProbFromAmericanOdds(50000)).toBe(0.01);
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

  it("caps at MAX_BASE_HS (500) for extreme probabilities", () => {
    // prob = 0.01 → raw = 100 * 0.99 / 0.01 = 9900 → capped at 500
    expect(baseHeatScore(0.01)).toBe(500);
    expect(baseHeatScore(0.05)).toBe(500);
  });

  it("does not cap moderate underdog picks", () => {
    // prob = 0.25 → 300, under cap
    expect(baseHeatScore(0.25)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// pickHeatScoreOnHit / pickHeatScoreOnMiss (asymmetric scoring)
// ---------------------------------------------------------------------------

describe("pickHeatScoreOnHit", () => {
  it("returns base score at 1.0x multiplier", () => {
    expect(pickHeatScoreOnHit(0.5, 1.0)).toBe(100);
  });

  it("applies Frosty multiplier (0.25x)", () => {
    expect(pickHeatScoreOnHit(0.5, 0.25)).toBe(25);
  });

  it("applies Volcanic multiplier (4.0x)", () => {
    expect(pickHeatScoreOnHit(0.5, 4.0)).toBe(400);
  });

  it("returns less for favorites (lower odds-based reward)", () => {
    // -200 favorite, standard notch
    expect(pickHeatScoreOnHit(impliedProbFromAmericanOdds(-200), 1.0)).toBe(50);
  });

  it("returns more for underdogs (higher odds-based reward)", () => {
    // +200 underdog, standard notch
    expect(pickHeatScoreOnHit(impliedProbFromAmericanOdds(200), 1.0)).toBe(200);
  });
});

describe("pickHeatScoreOnMiss", () => {
  it("returns flat 100 at standard notch", () => {
    expect(pickHeatScoreOnMiss(1.0)).toBe(100);
  });

  it("scales with notch multiplier only", () => {
    expect(pickHeatScoreOnMiss(0.25)).toBe(25); // Frosty
    expect(pickHeatScoreOnMiss(0.5)).toBe(50); // Chilled
    expect(pickHeatScoreOnMiss(1.75)).toBe(175); // Heated
    expect(pickHeatScoreOnMiss(4.0)).toBe(400); // Volcanic
  });

  it("does NOT depend on odds", () => {
    // Miss penalty is the same regardless of the pick's implied probability
    expect(pickHeatScoreOnMiss(1.0)).toBe(100);
  });
});

describe("asymmetric EV balance", () => {
  it("produces ~0 EV for a 50/50 standard pick", () => {
    const prob = 0.5;
    const win = pickHeatScoreOnHit(prob, 1.0);
    const loss = pickHeatScoreOnMiss(1.0);
    const ev = prob * win - (1 - prob) * loss;
    expect(Math.abs(ev)).toBeLessThan(1);
  });

  it("produces ~0 EV for a 60% favorite at standard", () => {
    const prob = 0.6;
    const win = pickHeatScoreOnHit(prob, 1.0);
    const loss = pickHeatScoreOnMiss(1.0);
    const ev = prob * win - (1 - prob) * loss;
    expect(Math.abs(ev)).toBeLessThan(5); // rounding tolerance
  });

  it("produces ~0 EV for a 40% underdog at standard", () => {
    const prob = 0.4;
    const win = pickHeatScoreOnHit(prob, 1.0);
    const loss = pickHeatScoreOnMiss(1.0);
    const ev = prob * win - (1 - prob) * loss;
    expect(Math.abs(ev)).toBeLessThan(5);
  });

  it("produces ~0 EV for a Volcanic pick at even odds", () => {
    const prob = 0.5;
    const mult = 4.0;
    const win = pickHeatScoreOnHit(prob, mult);
    const loss = pickHeatScoreOnMiss(mult);
    const ev = prob * win - (1 - prob) * loss;
    expect(Math.abs(ev)).toBeLessThan(1);
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

  it("handles asymmetric hit/miss values correctly", () => {
    // Simulates a 2-pick card: one underdog hit (+150), one favorite miss (-100)
    const result = computeCardHeatScore(
      [
        { heatScore: 150, result: "hit" },
        { heatScore: -100, result: "miss" },
      ],
      2,
    );
    expect(result.netRaw).toBe(50);
    expect(result.multiplier).toBe(1.0); // 1/2 = no multiplier
    expect(result.final).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: odds → probability → pick HS → card HS
// ---------------------------------------------------------------------------

describe("end-to-end HeatScore calculation", () => {
  it("computes a full 3-pick card at standard notch with real odds", () => {
    // Pick 1: -110 over (standard favorite)
    const prob1 = impliedProbFromAmericanOdds(-110);
    const hit1 = pickHeatScoreOnHit(prob1, 1.0); // ~91
    const _miss1 = pickHeatScoreOnMiss(1.0); // 100 (not used in this scenario)

    // Pick 2: +150 underdog
    const prob2 = impliedProbFromAmericanOdds(150);
    const hit2 = pickHeatScoreOnHit(prob2, 1.0); // ~150
    const _miss2 = pickHeatScoreOnMiss(1.0); // 100 (not used in this scenario)

    // Pick 3: -200 heavy favorite
    const prob3 = impliedProbFromAmericanOdds(-200);
    const _hit3 = pickHeatScoreOnHit(prob3, 1.0); // ~50 (not used in this scenario)
    const miss3 = pickHeatScoreOnMiss(1.0); // 100

    // Scenario: picks 1 and 2 hit, pick 3 misses (2/3)
    const card = computeCardHeatScore(
      [
        { heatScore: hit1, result: "hit" },
        { heatScore: hit2, result: "hit" },
        { heatScore: -miss3, result: "miss" },
      ],
      3,
    );

    // Net = 91 + 150 - 100 = 141, multiplier = 1.0 (2/3 on 3-pick), final = 141
    expect(card.netRaw).toBe(hit1 + hit2 - miss3);
    expect(card.multiplier).toBe(1.0);
    expect(card.final).toBe(card.netRaw);
  });

  it("computes a Volcanic perfect 2-pick card", () => {
    const prob = impliedProbFromAmericanOdds(-110);
    const volcanicMult = 4.0;
    const hit = pickHeatScoreOnHit(prob, volcanicMult);
    // 91 * 4 = 364

    const card = computeCardHeatScore(
      [
        { heatScore: hit, result: "hit" },
        { heatScore: hit, result: "hit" },
      ],
      2,
    );

    expect(card.multiplier).toBe(1.5);
    expect(card.final).toBe(Math.round(hit * 2 * 1.5));
  });
});
