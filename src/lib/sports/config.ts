/**
 * Centralized sport configuration registry.
 * Client-safe — no server imports.
 */
import type { StatCategory } from "@/lib/supabase/types";

/* ---------- Keys & Types ---------- */

export const SPORT_KEYS = ["nba", "ncaab", "epl", "la_liga", "nhl", "mlb"] as const;
export type SportKey = (typeof SPORT_KEYS)[number];

export type CategoryOption = { value: StatCategory | "all"; label: string };

export interface HeadshotConfig {
  getUrl: (playerId: string) => string;
  isProxied: boolean;
  width: number;
  height: number;
}

export interface SportConfig {
  key: SportKey;
  displayName: string;
  shortLabel: string;
  icon: string;
  isSoccer: boolean;
  usesHalves: boolean;
  categories: CategoryOption[];
  headshot: HeadshotConfig;
}

/* ---------- Category Arrays ---------- */

const BASKETBALL_CATEGORIES: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "points", label: "Points" },
  { value: "rebounds", label: "Rebounds" },
  { value: "assists", label: "Assists" },
  { value: "threes", label: "3PM" },
  { value: "steals", label: "Steals" },
  { value: "blocks", label: "Blocks" },
  { value: "turnovers", label: "Turnovers" },
  { value: "pra", label: "PRA" },
  { value: "pts_reb", label: "Pts+Reb" },
  { value: "pts_ast", label: "Pts+Ast" },
  { value: "reb_ast", label: "Reb+Ast" },
  { value: "blk_stl", label: "Blk+Stl" },
];

const BASEBALL_CATEGORIES: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "hits", label: "Hits" },
  { value: "home_runs", label: "Home Runs" },
  { value: "rbis", label: "RBIs" },
  { value: "runs", label: "Runs" },
  { value: "stolen_bases", label: "Stolen Bases" },
  { value: "total_bases", label: "Total Bases" },
  { value: "pitcher_strikeouts", label: "Strikeouts (P)" },
  { value: "pitcher_outs", label: "Outs (P)" },
  { value: "hits_runs_rbis", label: "H+R+RBI" },
];

const SOCCER_CATEGORIES: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "shots", label: "Shots" },
  { value: "shots_on_target", label: "On Target" },
  { value: "goals", label: "Goals" },
  { value: "assists", label: "Assists" },
];

/* ---------- Config Record ---------- */

export const SPORT_CONFIG: Record<SportKey, SportConfig> = {
  nba: {
    key: "nba",
    displayName: "NBA",
    shortLabel: "NBA",
    icon: "\uD83C\uDFC0",
    isSoccer: false,
    usesHalves: false,
    categories: BASKETBALL_CATEGORIES,
    headshot: {
      getUrl: (id) => `https://cdn.nba.com/headshots/nba/latest/260x190/${id}.png`,
      isProxied: false,
      width: 130,
      height: 100,
    },
  },
  ncaab: {
    key: "ncaab",
    displayName: "NCAAB",
    shortLabel: "NCAAB",
    icon: "\uD83C\uDF93",
    isSoccer: false,
    usesHalves: true,
    categories: BASKETBALL_CATEGORIES,
    headshot: {
      getUrl: (id) =>
        `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${id}.png&w=260&h=190`,
      isProxied: false,
      width: 130,
      height: 100,
    },
  },
  epl: {
    key: "epl",
    displayName: "Premier League",
    shortLabel: "EPL",
    icon: "\u26BD",
    isSoccer: true,
    usesHalves: true,
    categories: SOCCER_CATEGORIES,
    headshot: {
      getUrl: (id) => `/api/players/${id}/photo`,
      isProxied: true,
      width: 90,
      height: 90,
    },
  },
  la_liga: {
    key: "la_liga",
    displayName: "La Liga",
    shortLabel: "La Liga",
    icon: "\u26BD",
    isSoccer: true,
    usesHalves: true,
    categories: SOCCER_CATEGORIES,
    headshot: {
      getUrl: (id) => `/api/players/${id}/photo`,
      isProxied: true,
      width: 90,
      height: 90,
    },
  },
  nhl: {
    key: "nhl",
    displayName: "NHL",
    shortLabel: "NHL",
    icon: "\uD83C\uDFD2",
    isSoccer: false,
    usesHalves: false,
    categories: BASKETBALL_CATEGORIES, // placeholder until NHL-specific categories
    headshot: {
      getUrl: (id) => `https://cms.nhl.bamgrid.com/images/headshots/current/168x168/${id}.jpg`,
      isProxied: false,
      width: 130,
      height: 100,
    },
  },
  mlb: {
    key: "mlb",
    displayName: "MLB",
    shortLabel: "MLB",
    icon: "\u26BE",
    isSoccer: false,
    usesHalves: false,
    categories: BASEBALL_CATEGORIES,
    headshot: {
      getUrl: (id) => `https://a.espncdn.com/combiner/i?img=/i/headshots/mlb/players/full/${id}.png&w=260&h=190`,
      isProxied: false,
      width: 130,
      height: 100,
    },
  },
};

/* ---------- UI Subsets ---------- */

/** Sports shown in selector tabs and auto-select priority order (NHL omitted until ready). */
export const UI_SPORTS: SportKey[] = ["nba", "mlb", "ncaab", "epl", "la_liga"];

/** Auto-select priority order on props page. Same as UI_SPORTS — split if they diverge. */
export const SPORT_PRIORITY = UI_SPORTS;

/* ---------- Derived Maps ---------- */

export const SPORT_LABELS: Record<SportKey, string> = Object.fromEntries(
  SPORT_KEYS.map((k) => [k, SPORT_CONFIG[k].shortLabel]),
) as Record<SportKey, string>;

/* ---------- Helpers ---------- */

export function isValidSport(v: string): v is SportKey {
  return (SPORT_KEYS as readonly string[]).includes(v);
}

export function isSoccer(sport: string): boolean {
  return isValidSport(sport) && SPORT_CONFIG[sport].isSoccer;
}

export function usesHalves(sport: string): boolean {
  return isValidSport(sport) && SPORT_CONFIG[sport].usesHalves;
}

export function getSportCategories(sport: string): CategoryOption[] {
  if (isValidSport(sport)) return SPORT_CONFIG[sport].categories;
  return SPORT_CONFIG.nba.categories;
}

export function getHeadshotConfig(sport?: string): HeadshotConfig {
  if (sport && isValidSport(sport)) return SPORT_CONFIG[sport].headshot;
  return SPORT_CONFIG.nba.headshot;
}

export function getPlayerHeadshotUrl(playerId: string, sport?: string): string {
  if (!playerId) return "";
  return getHeadshotConfig(sport).getUrl(playerId);
}
