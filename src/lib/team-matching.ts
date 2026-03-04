/**
 * Sport-agnostic team name normalization.
 *
 * Used by both the general `teamsMatch` helper (NBA, soccer) and
 * the NCAAB-specific matching in `src/lib/ncaab/matching.ts`.
 */

export function normalizeTeam(name: string): string {
  // Note: "St."/"St" is always expanded to "state" — no distinction between
  // "Saint" and "State" abbreviations. This works because both the Odds API
  // and ESPN use the same abbreviation for any given school. If they ever
  // diverge (e.g. ESPN sends "Mount Saint Mary's" while Odds API sends
  // "Mt. St. Mary's"), add an alias to NCAAB_TEAM_ALIASES.
  return name
    .toLowerCase()
    .replace(/\bst\.\s*/g, "state ")   // "St." → "State"
    .replace(/\bst\b/g, "state")       // "St" (no period, word boundary) → "State"
    .replace(/\bmt\.\s*/g, "mount ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}
