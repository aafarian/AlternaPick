import { describe, it, expect } from "vitest";
import { hasEnoughProps, MIN_PROPS_TO_SKIP } from "../cache";

/** Build a Map<string, number> from team counts. Use "" key for null-team (unenriched) props. */
function counts(teams: Record<string, number>): Map<string, number> {
  return new Map(Object.entries(teams));
}

describe("hasEnoughProps", () => {
  it("returns false for empty map (no props at all)", () => {
    expect(hasEnoughProps(new Map())).toBe(false);
  });

  it("returns true when both teams meet the threshold", () => {
    expect(hasEnoughProps(counts({ LAL: 12, BOS: 15 }))).toBe(true);
  });

  it("returns false when only one real team has props", () => {
    expect(hasEnoughProps(counts({ LAL: 30 }))).toBe(false);
  });

  it("returns false when one team is below threshold", () => {
    expect(hasEnoughProps(counts({ LAL: 30, BOS: 5 }))).toBe(false);
  });

  it("returns true when both teams are exactly at threshold", () => {
    expect(
      hasEnoughProps(counts({ LAL: MIN_PROPS_TO_SKIP, BOS: MIN_PROPS_TO_SKIP })),
    ).toBe(true);
  });

  it("falls back to total count when only null-team bucket exists (e.g. soccer)", () => {
    expect(hasEnoughProps(counts({ "": MIN_PROPS_TO_SKIP }))).toBe(true);
    expect(hasEnoughProps(counts({ "": MIN_PROPS_TO_SKIP - 1 }))).toBe(false);
  });

  it("treats mixed null-bucket + single real team as insufficient", () => {
    // 15 for LAL + 10 unenriched — only 1 real team, should re-poll
    expect(hasEnoughProps(counts({ LAL: 15, "": 10 }))).toBe(false);
  });

  it("ignores null-team bucket when two real teams are present", () => {
    expect(hasEnoughProps(counts({ LAL: 12, BOS: 11, "": 5 }))).toBe(true);
  });

  it("returns false when nulls inflate total but one team is below threshold", () => {
    expect(hasEnoughProps(counts({ LAL: 12, BOS: 3, "": 10 }))).toBe(false);
  });

  it("handles 3+ distinct teams (data quality edge case)", () => {
    expect(
      hasEnoughProps(counts({ LAL: 10, BOS: 10, "Boston Celtics": 2 })),
    ).toBe(false);
  });

  it("respects custom threshold parameter", () => {
    expect(hasEnoughProps(counts({ LAL: 5, BOS: 5 }), 5)).toBe(true);
    expect(hasEnoughProps(counts({ LAL: 5, BOS: 4 }), 5)).toBe(false);
  });
});
