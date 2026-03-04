/**
 * NCAAB team name normalization and matching utilities.
 *
 * Used by the game sync endpoint and its tests.
 */

export function normalizeTeam(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bst\.\s*/g, "state ")   // "St." → "State"
    .replace(/\bst\b/g, "state")       // "St" (no period, word boundary) → "State"
    .replace(/\bmt\.\s*/g, "mount ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * NCAAB-specific team name aliases.
 * Maps abbreviated Odds API names to the full ESPN displayName.
 * Only the portion before the mascot needs to match.
 */
export const NCAAB_TEAM_ALIASES: Record<string, string> = {
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

export function normalizeNcaabTeam(name: string): string {
  const base = normalizeTeam(name);
  for (const [abbrev, full] of Object.entries(NCAAB_TEAM_ALIASES)) {
    if (base.startsWith(abbrev + " ") || base === abbrev) {
      return full + base.slice(abbrev.length);
    }
  }
  return base;
}

export function ncaabTeamsMatch(dbTeam: string, espnTeam: string): boolean {
  if (dbTeam === espnTeam) return true;
  const a = normalizeNcaabTeam(dbTeam);
  const b = normalizeNcaabTeam(espnTeam);
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // Fallback: compare mascot (last word) — most NCAAB mascots are unique
  const mascotA = a.split(" ").pop() ?? "";
  const mascotB = b.split(" ").pop() ?? "";
  if (mascotA.length > 3 && mascotA === mascotB) {
    const wordsA = a.split(" ").slice(0, -1);
    const wordsB = b.split(" ").slice(0, -1);
    return wordsA.some((w) => w.length > 2 && wordsB.some((wb) => wb.includes(w) || w.includes(wb)));
  }
  return false;
}

/**
 * Find a matching DB game for an ESPN game, trying both normal and
 * swapped home/away orientations. Returns the match and whether
 * the orientation was swapped (so scores can be assigned correctly).
 */
export function findNcaabMatch<T extends { home_team: string; away_team: string; external_event_id?: string | null }>(
  candidates: T[],
  espnGame: { home_team: string; away_team: string },
  requireUnmatched = false,
): { match: T | null; isSwapped: boolean } {
  const filter = (g: T) => !requireUnmatched || !g.external_event_id;

  const normalMatch = candidates.find(
    (g) =>
      filter(g) &&
      ncaabTeamsMatch(g.home_team, espnGame.home_team) &&
      ncaabTeamsMatch(g.away_team, espnGame.away_team),
  );
  if (normalMatch) return { match: normalMatch, isSwapped: false };

  const swappedMatch = candidates.find(
    (g) =>
      filter(g) &&
      ncaabTeamsMatch(g.home_team, espnGame.away_team) &&
      ncaabTeamsMatch(g.away_team, espnGame.home_team),
  );
  if (swappedMatch) return { match: swappedMatch, isSwapped: true };

  return { match: null, isSwapped: false };
}
