/**
 * Tests for NCAAB team name matching in game sync.
 *
 * Imports the production matching functions from src/lib/ncaab/matching.ts
 * to ensure tests validate the actual code used in sync-status/route.ts.
 */
import { describe, it, expect } from "vitest";
import { normalizeTeam, ncaabTeamsMatch, findNcaabMatch } from "@/lib/ncaab/matching";

// --- Tests ---

describe("normalizeTeam", () => {
  it("normalizes St to State", () => {
    expect(normalizeTeam("Florida St Seminoles")).toBe("florida state seminoles");
  });

  it("normalizes St. to State", () => {
    expect(normalizeTeam("Florida St. Seminoles")).toBe("florida state seminoles");
  });

  it("normalizes Mt. to Mount", () => {
    expect(normalizeTeam("Mt. St. Mary's")).toBe("mount state mary's");
  });

  it("lowercases and trims", () => {
    expect(normalizeTeam("  UCLA Bruins  ")).toBe("ucla bruins");
  });

  it("normalizes & to and", () => {
    expect(normalizeTeam("Brighton & Hove Albion")).toBe("brighton and hove albion");
  });
});

describe("ncaabTeamsMatch", () => {
  it("matches exact names", () => {
    expect(ncaabTeamsMatch("South Carolina Gamecocks", "South Carolina Gamecocks")).toBe(true);
  });

  it("matches St vs State", () => {
    expect(ncaabTeamsMatch("Florida St Seminoles", "Florida State Seminoles")).toBe(true);
  });

  it("matches N Colorado → Northern Colorado", () => {
    expect(ncaabTeamsMatch("N Colorado Bears", "Northern Colorado Bears")).toBe(true);
  });

  it("matches SE Louisiana → Southeastern Louisiana", () => {
    expect(ncaabTeamsMatch("SE Louisiana Lions", "Southeastern Louisiana Lions")).toBe(true);
  });

  it("matches E Michigan → Eastern Michigan", () => {
    expect(ncaabTeamsMatch("E Michigan Eagles", "Eastern Michigan Eagles")).toBe(true);
  });

  it("matches E Washington → Eastern Washington", () => {
    expect(ncaabTeamsMatch("E Washington Eagles", "Eastern Washington Eagles")).toBe(true);
  });

  it("matches W Virginia → West Virginia", () => {
    expect(ncaabTeamsMatch("W Virginia Mountaineers", "West Virginia Mountaineers")).toBe(true);
  });

  it("matches W Michigan → Western Michigan", () => {
    expect(ncaabTeamsMatch("W Michigan Broncos", "Western Michigan Broncos")).toBe(true);
  });

  it("matches N Illinois → Northern Illinois", () => {
    expect(ncaabTeamsMatch("N Illinois Huskies", "Northern Illinois Huskies")).toBe(true);
  });

  it("matches UL Monroe → Louisiana-Monroe", () => {
    expect(ncaabTeamsMatch("UL Monroe Warhawks", "Louisiana-Monroe Warhawks")).toBe(true);
  });

  it("matches Texas A&M-CC → Texas A&M-Corpus Christi", () => {
    expect(ncaabTeamsMatch("Texas A&M-CC Islanders", "Texas A&M-Corpus Christi Islanders")).toBe(true);
  });

  it("matches GW → George Washington", () => {
    expect(ncaabTeamsMatch("GW Revolutionaries", "George Washington Revolutionaries")).toBe(true);
  });

  it("matches Alabama St → Alabama State", () => {
    expect(ncaabTeamsMatch("Alabama St Hornets", "Alabama State Hornets")).toBe(true);
  });

  it("matches Grambling St → Grambling (ESPN omits State)", () => {
    expect(ncaabTeamsMatch("Grambling St Tigers", "Grambling Tigers")).toBe(true);
  });

  it("matches Miss Valley St → Mississippi Valley State", () => {
    expect(ncaabTeamsMatch("Miss Valley St Delta Devils", "Mississippi Valley State Delta Devils")).toBe(true);
  });

  it("matches Loyola (Chi) → Loyola Chicago", () => {
    expect(ncaabTeamsMatch("Loyola (Chi) Ramblers", "Loyola Chicago Ramblers")).toBe(true);
  });

  it("matches LIU → Long Island University", () => {
    expect(ncaabTeamsMatch("LIU Sharks", "Long Island University Sharks")).toBe(true);
  });

  it("matches Arkansas-Little Rock → Little Rock", () => {
    expect(ncaabTeamsMatch("Arkansas-Little Rock Trojans", "Little Rock Trojans")).toBe(true);
  });

  it("matches UMKC Kangaroos → Kansas City Roos (mascot rebrand)", () => {
    expect(ncaabTeamsMatch("UMKC Kangaroos", "Kansas City Roos")).toBe(true);
  });

  it("matches Grand Canyon Antelopes → Grand Canyon Lopes (mascot rebrand)", () => {
    expect(ncaabTeamsMatch("Grand Canyon Antelopes", "Grand Canyon Lopes")).toBe(true);
  });

  it("matches CSU Bakersfield → Cal State Bakersfield", () => {
    expect(ncaabTeamsMatch("CSU Bakersfield Roadrunners", "Cal State Bakersfield Roadrunners")).toBe(true);
  });

  it("does not match unrelated teams", () => {
    expect(ncaabTeamsMatch("Duke Blue Devils", "North Carolina Tar Heels")).toBe(false);
  });

  it("matches via substring inclusion", () => {
    expect(ncaabTeamsMatch("Tennessee Volunteers", "Tennessee Volunteers")).toBe(true);
  });

  it("matches via mascot fallback with location overlap", () => {
    // "N Carolina A&T Aggies" vs "North Carolina A&T Aggies"
    expect(ncaabTeamsMatch("N Carolina A&T Aggies", "North Carolina A&T Aggies")).toBe(true);
  });
});

describe("findNcaabMatch", () => {
  const dbGames = [
    { home_team: "Alabama St Hornets", away_team: "Southern Jaguars", external_event_id: null },
    { home_team: "Duke Blue Devils", away_team: "UNC Tar Heels", external_event_id: "123" },
  ];

  it("finds normal orientation match", () => {
    const { match, isSwapped } = findNcaabMatch(dbGames, {
      home_team: "Alabama State Hornets",
      away_team: "Southern Jaguars",
    });
    expect(match).toBe(dbGames[0]);
    expect(isSwapped).toBe(false);
  });

  it("finds swapped orientation match", () => {
    const { match, isSwapped } = findNcaabMatch(dbGames, {
      home_team: "Southern Jaguars",
      away_team: "Alabama State Hornets",
    });
    expect(match).toBe(dbGames[0]);
    expect(isSwapped).toBe(true);
  });

  it("returns null when no match", () => {
    const { match } = findNcaabMatch(dbGames, {
      home_team: "Kansas Jayhawks",
      away_team: "Baylor Bears",
    });
    expect(match).toBeNull();
  });

  it("respects requireUnmatched flag", () => {
    const { match } = findNcaabMatch(dbGames, {
      home_team: "Duke Blue Devils",
      away_team: "UNC Tar Heels",
    }, true);
    // Duke already has external_event_id, so should not match with requireUnmatched
    expect(match).toBeNull();
  });
});
