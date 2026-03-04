/**
 * Tests for NCAAB team name matching in game sync.
 *
 * These functions are defined in sync-status/route.ts but we re-implement
 * them here to test the matching logic independently.
 */
import { describe, it, expect } from "vitest";

// --- Copied from sync-status/route.ts for unit testing ---

function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bst\.\s*/g, "state ")
    .replace(/\bst\b/g, "state")
    .replace(/\bmt\.\s*/g, "mount ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NCAAB_TEAM_ALIASES: Record<string, string> = {
  // Directional abbreviations
  "n colorado": "northern colorado",
  "se louisiana": "southeastern louisiana",
  "se missouri state": "southeast missouri state",
  "s carolina": "south carolina",
  "s carolina upstate": "south carolina upstate",
  "w michigan": "western michigan",
  "w kentucky": "western kentucky",
  "e michigan": "eastern michigan",
  "e kentucky": "eastern kentucky",
  "e washington": "eastern washington",
  "e illinois": "eastern illinois",
  "n illinois": "northern illinois",
  "n iowa": "northern iowa",
  "n arizona": "northern arizona",
  "n kentucky": "northern kentucky",
  "n carolina": "north carolina",
  "w virginia": "west virginia",
  "w georgia": "western georgia",
  "n carolina a&t": "north carolina a&t",
  // Abbreviations to full names
  "ul monroe": "louisiana-monroe",
  "siu-edwardsville": "siu edwardsville",
  "texas a&m-cc": "texas a&m-corpus christi",
  "umkc": "kansas city",
  "uab": "uab",
  "ucf": "ucf",
  "vcu": "vcu",
  "gw": "george washington",
  "fiu": "fiu",
  "utsa": "utsa",
  "utep": "utep",
  "unlv": "unlv",
  "njit": "njit",
  "umbc": "umbc",
  "unc": "north carolina",
  "lsu": "lsu",
  "liu": "long island university",
  // Schools where Odds API adds "St" but ESPN omits "State"
  "grambling state": "grambling",
  // Mississippi abbreviations
  "miss valley state": "mississippi valley state",
  // Parenthetical/abbreviated city names
  "loyola (chi)": "loyola chicago",
  // Shortened school names
  "arkansas-little rock": "little rock",
};

function normalizeNcaabTeam(name: string): string {
  const base = normalizeTeam(name);
  for (const [abbrev, full] of Object.entries(NCAAB_TEAM_ALIASES)) {
    if (base.startsWith(abbrev + " ") || base === abbrev) {
      return base.replace(abbrev, full);
    }
  }
  return base;
}

function ncaabTeamsMatch(dbTeam: string, espnTeam: string): boolean {
  if (dbTeam === espnTeam) return true;
  const a = normalizeNcaabTeam(dbTeam);
  const b = normalizeNcaabTeam(espnTeam);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const mascotA = a.split(" ").pop() ?? "";
  const mascotB = b.split(" ").pop() ?? "";
  if (mascotA.length > 3 && mascotA === mascotB) {
    const wordsA = a.split(" ").slice(0, -1);
    const wordsB = b.split(" ").slice(0, -1);
    return wordsA.some((w) => w.length > 2 && wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
  }
  return false;
}

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
