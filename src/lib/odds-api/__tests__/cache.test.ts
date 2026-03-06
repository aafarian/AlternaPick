import { describe, it, expect } from "vitest";
import { hasEnoughProps, MIN_PROPS_TO_SKIP } from "../cache";

function makeProps(
  teams: Record<string, number>,
  nullCount = 0,
): { player_team: string | null }[] {
  const props: { player_team: string | null }[] = [];
  for (const [team, count] of Object.entries(teams)) {
    for (let i = 0; i < count; i++) props.push({ player_team: team });
  }
  for (let i = 0; i < nullCount; i++) props.push({ player_team: null });
  return props;
}

describe("hasEnoughProps", () => {
  it("returns false when total props below threshold", () => {
    expect(hasEnoughProps(makeProps({ LAL: 3, BOS: 4 }))).toBe(false);
  });

  it("returns true when both teams meet the threshold", () => {
    expect(hasEnoughProps(makeProps({ LAL: 12, BOS: 15 }))).toBe(true);
  });

  it("returns false when only one team has props", () => {
    expect(hasEnoughProps(makeProps({ LAL: 30 }))).toBe(false);
  });

  it("returns false when one team is below threshold", () => {
    expect(hasEnoughProps(makeProps({ LAL: 30, BOS: 5 }))).toBe(false);
  });

  it("returns true when both teams are exactly at threshold", () => {
    expect(
      hasEnoughProps(makeProps({ LAL: MIN_PROPS_TO_SKIP, BOS: MIN_PROPS_TO_SKIP })),
    ).toBe(true);
  });

  it("falls back to total count when all player_team values are null", () => {
    expect(hasEnoughProps(makeProps({}, MIN_PROPS_TO_SKIP))).toBe(true);
    expect(hasEnoughProps(makeProps({}, MIN_PROPS_TO_SKIP - 1))).toBe(false);
  });

  it("treats mixed null + single team as insufficient", () => {
    // 15 for LAL + 10 null — only 1 distinct team, should re-poll
    expect(hasEnoughProps(makeProps({ LAL: 15 }, 10))).toBe(false);
  });

  it("ignores null props when two teams are present and both meet threshold", () => {
    expect(hasEnoughProps(makeProps({ LAL: 12, BOS: 11 }, 5))).toBe(true);
  });

  it("returns false when nulls inflate total but one team is below threshold", () => {
    // LAL: 12, BOS: 3, null: 10 — total is 25 but BOS < 10
    expect(hasEnoughProps(makeProps({ LAL: 12, BOS: 3 }, 10))).toBe(false);
  });

  it("handles 3+ distinct teams (data quality edge case)", () => {
    // If team names are inconsistent, min of all must meet threshold
    expect(hasEnoughProps(makeProps({ LAL: 10, BOS: 10, "Boston Celtics": 2 }))).toBe(
      false,
    );
  });

  it("returns false for empty props array", () => {
    expect(hasEnoughProps([])).toBe(false);
  });

  it("respects custom threshold parameter", () => {
    expect(hasEnoughProps(makeProps({ LAL: 5, BOS: 5 }), 5)).toBe(true);
    expect(hasEnoughProps(makeProps({ LAL: 5, BOS: 4 }), 5)).toBe(false);
  });
});
