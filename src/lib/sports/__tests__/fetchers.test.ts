import { describe, it, expect } from "vitest";
import { formatDateForSport, lookbackDatesForSport } from "../fetchers";

describe("formatDateForSport", () => {
  const date = new Date("2025-03-15T22:00:00Z");

  it("returns YYYYMMDD for NBA", () => {
    expect(formatDateForSport("nba", date)).toBe("20250315");
  });

  it("returns YYYYMMDD for NCAAB", () => {
    expect(formatDateForSport("ncaab", date)).toBe("20250315");
  });

  it("returns YYYY-MM-DD for EPL", () => {
    expect(formatDateForSport("epl", date)).toBe("2025-03-15");
  });

  it("returns YYYY-MM-DD for La Liga", () => {
    expect(formatDateForSport("la_liga", date)).toBe("2025-03-15");
  });

  it("defaults to YYYYMMDD for unknown sport", () => {
    expect(formatDateForSport("unknown_sport", date)).toBe("20250315");
  });

  it("handles UTC midnight boundary correctly", () => {
    const midnightDate = new Date("2025-03-16T00:30:00Z");
    expect(formatDateForSport("nba", midnightDate)).toBe("20250316");
    expect(formatDateForSport("epl", midnightDate)).toBe("2025-03-16");
  });
});

describe("lookbackDatesForSport", () => {
  const date = new Date("2025-03-15T22:00:00Z");

  it("returns game date + day before for ESPN sports", () => {
    expect(lookbackDatesForSport("nba", date)).toEqual(["20250315", "20250314"]);
    expect(lookbackDatesForSport("ncaab", date)).toEqual(["20250315", "20250314"]);
  });

  it("returns only game date for soccer sports", () => {
    expect(lookbackDatesForSport("epl", date)).toEqual(["2025-03-15"]);
    expect(lookbackDatesForSport("la_liga", date)).toEqual(["2025-03-15"]);
  });

  it("defaults to ESPN behavior for unknown sport", () => {
    const result = lookbackDatesForSport("unknown_sport", date);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("20250315");
    expect(result[1]).toBe("20250314");
  });
});
