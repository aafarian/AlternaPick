import type { StatCategory } from "@/lib/supabase/types";

/* ---------- Notification icons & accent classes ---------- */

const NOTIFICATION_ICONS: Record<string, string> = {
  card_resolved: "\uD83C\uDFAF",
  challenge_resolved: "\u2694\uFE0F",
  challenge_received: "\uD83D\uDCE9",
  challenge_accepted: "\u2705",
  friend_request: "\uD83D\uDC64",
  friend_accepted: "\uD83E\uDD1D",
  new_friend: "\uD83E\uDD1D",
};

export function getNotificationIcon(type: string): string {
  return NOTIFICATION_ICONS[type] ?? "\uD83D\uDD14";
}

const NOTIFICATION_ACCENTS: Record<string, string> = {
  card_resolved: "bg-neon-green/15 text-neon-green",
  challenge_resolved: "bg-electric-blue/15 text-electric-blue",
  challenge_received: "bg-amber-500/15 text-amber-400",
  challenge_accepted: "bg-neon-green/15 text-neon-green",
  friend_request: "bg-electric-blue/15 text-electric-blue",
  friend_accepted: "bg-amber-500/15 text-amber-400",
  new_friend: "bg-amber-500/15 text-amber-400",
};

export function getNotificationAccent(type: string): string {
  return NOTIFICATION_ACCENTS[type] ?? "bg-muted/15 text-muted-foreground";
}

/**
 * Derive a display-friendly notification title from type + body.
 * Handles both legacy ("Card Resolved") and new titles gracefully.
 */
export function getNotificationTitle(
  type: string,
  title: string,
  body: string
): string {
  // If title is already something fun (not the generic fallback), use it
  if (
    type === "card_resolved" &&
    title !== "Card Resolved" &&
    title !== "card_resolved"
  ) {
    return title;
  }
  if (
    type === "challenge_resolved" &&
    title !== "Challenge Resolved" &&
    title !== "challenge_resolved"
  ) {
    return title;
  }

  // Derive a better title for legacy notifications
  if (type === "card_resolved") {
    // Body: "Your card scored X/Y!" or "X out of Y. ..."
    const match = body.match(/(\d+)\/(\d+)/) ?? body.match(/(\d+) out of (\d+)/);
    if (match) {
      const score = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      const ratio = total > 0 ? score / total : 0;
      if (score === total) return "Perfect Card!";
      if (ratio >= 0.8) return "On Fire!";
      if (ratio >= 0.6) return "Nice Card!";
      if (ratio >= 0.4) return "Not Bad";
      if (score > 0) return "Tough Break";
      return "Ice Cold";
    }
    return "Card Results";
  }

  if (type === "challenge_resolved") {
    const lower = body.toLowerCase();
    if (lower.includes("destroyed") || lower.includes("dominated")) return "Dominant Win!";
    if (lower.includes("edged")) return "Clutch Win!";
    if (lower.includes("won") || lower.includes("beat")) return "Victory!";
    if (lower.includes("tie") || lower.includes("deadlock")) return "Dead Heat";
    if (lower.includes("fell just short")) return "So Close!";
    if (lower.includes("lost") || lower.includes("got you") || lower.includes("took it")) return "Tough Loss";
    return "Challenge Results";
  }

  return title;
}

/* ---------- Challenge status styles ---------- */

export const CHALLENGE_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  accepted: "bg-electric-blue/15 text-electric-blue border-electric-blue/30",
  active: "bg-neon-green/15 text-neon-green border-neon-green/30",
  resolved: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  declined: "bg-bold-red/15 text-bold-red border-bold-red/30",
  cancelled: "bg-muted/15 text-muted-foreground border-border",
};

/* ---------- Polling ---------- */

export const POLL_INTERVAL_MS = 30_000;

/* ---------- Player headshots ---------- */

export function getPlayerHeadshotUrl(playerId: string): string {
  if (!playerId) return "";
  // NBA player IDs are long numeric strings (10+ digits)
  if (playerId.length >= 8) {
    return `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`;
  }
  // ESPN player IDs (NCAAB) are shorter (4-7 digits)
  if (playerId.length >= 4) {
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/${playerId}.png&w=260&h=190`;
  }
  return "";
}

/* ---------- Team data ---------- */

const TEAM_TRICODES: Record<string, string> = {
  // NBA
  "Atlanta Hawks": "ATL",
  "Boston Celtics": "BOS",
  "Brooklyn Nets": "BKN",
  "Charlotte Hornets": "CHA",
  "Chicago Bulls": "CHI",
  "Cleveland Cavaliers": "CLE",
  "Dallas Mavericks": "DAL",
  "Denver Nuggets": "DEN",
  "Detroit Pistons": "DET",
  "Golden State Warriors": "GSW",
  "Houston Rockets": "HOU",
  "Indiana Pacers": "IND",
  "Los Angeles Clippers": "LAC",
  "LA Clippers": "LAC",
  "Los Angeles Lakers": "LAL",
  "Memphis Grizzlies": "MEM",
  "Miami Heat": "MIA",
  "Milwaukee Bucks": "MIL",
  "Minnesota Timberwolves": "MIN",
  "New Orleans Pelicans": "NOP",
  "New York Knicks": "NYK",
  "Oklahoma City Thunder": "OKC",
  "Orlando Magic": "ORL",
  "Philadelphia 76ers": "PHI",
  "Phoenix Suns": "PHX",
  "Portland Trail Blazers": "POR",
  "Sacramento Kings": "SAC",
  "San Antonio Spurs": "SAS",
  "Toronto Raptors": "TOR",
  "Utah Jazz": "UTA",
  "Washington Wizards": "WAS",
  // EPL
  "Arsenal": "ARS",
  "Aston Villa": "AVL",
  "AFC Bournemouth": "BOU",
  "Brentford": "BRE",
  "Brighton & Hove Albion": "BHA",
  "Brighton and Hove Albion": "BHA",
  "Chelsea": "CHE",
  "Crystal Palace": "CRY",
  "Everton": "EVE",
  "Fulham": "FUL",
  "Ipswich Town": "IPS",
  "Leicester City": "LEI",
  "Liverpool": "LIV",
  "Manchester City": "MCI",
  "Manchester United": "MUN",
  "Newcastle United": "NEW",
  "Nottingham Forest": "NFO",
  "Southampton": "SOU",
  "Tottenham Hotspur": "TOT",
  "West Ham United": "WHU",
  "Wolverhampton Wanderers": "WOL",
  "Wolves": "WOL",
};

export function teamTricode(teamName: string): string {
  return TEAM_TRICODES[teamName] ?? teamName.slice(0, 3).toUpperCase();
}

// Reverse lookup: tricode → lowercase full team names
const TRICODE_TO_NAMES: Record<string, string[]> = {};
for (const [name, tricode] of Object.entries(TEAM_TRICODES)) {
  if (!TRICODE_TO_NAMES[tricode]) TRICODE_TO_NAMES[tricode] = [];
  TRICODE_TO_NAMES[tricode].push(name.toLowerCase());
}

/** Check if a player's team tricode matches a search query (by tricode or full team name). */
export function teamMatchesQuery(tricode: string | null, query: string): boolean {
  if (!tricode || !query) return false;
  if (tricode.toLowerCase().includes(query)) return true;
  const names = TRICODE_TO_NAMES[tricode];
  return names ? names.some((n) => n.includes(query)) : false;
}

const TEAM_NBA_IDS: Record<string, number> = {
  ATL: 1610612737, BOS: 1610612738, BKN: 1610612751, CHA: 1610612766,
  CHI: 1610612741, CLE: 1610612739, DAL: 1610612742, DEN: 1610612743,
  DET: 1610612765, GSW: 1610612744, HOU: 1610612745, IND: 1610612754,
  LAC: 1610612746, LAL: 1610612747, MEM: 1610612763, MIA: 1610612748,
  MIL: 1610612749, MIN: 1610612750, NOP: 1610612740, NYK: 1610612752,
  OKC: 1610612760, ORL: 1610612753, PHI: 1610612755, PHX: 1610612756,
  POR: 1610612757, SAC: 1610612758, SAS: 1610612759, TOR: 1610612761,
  UTA: 1610612762, WAS: 1610612764,
};

const EPL_TEAM_IDS: Record<string, number> = {
  ARS: 42, AVL: 66, BOU: 35, BRE: 55, BHA: 51, CHE: 49, CRY: 52,
  EVE: 45, FUL: 36, IPS: 57, LEI: 46, LIV: 40, MCI: 50, MUN: 33,
  NEW: 34, NFO: 65, SOU: 41, TOT: 47, WHU: 48, WOL: 39,
};

// NCAAB team ESPN IDs — populated dynamically from ESPN scoreboard data
const ncaabTeamEspnIds = new Map<string, string>();

/** Register ESPN team IDs for NCAAB teams (called from server-side data fetching). */
export function registerNcaabTeamIds(teams: Array<{ name: string; id: string }>) {
  for (const t of teams) {
    if (t.name && t.id) {
      ncaabTeamEspnIds.set(t.name.toLowerCase(), t.id);
    }
  }
}

function normalizeTeamStr(s: string): string {
  return s.toLowerCase().replace(/\bst\.\s*/g, "saint ").replace(/\bmt\.\s*/g, "mount ").replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function getNcaabEspnTeamId(teamName: string): string | undefined {
  const lower = teamName.toLowerCase();
  // Exact match
  const exact = ncaabTeamEspnIds.get(lower);
  if (exact) return exact;
  // Normalized match (handles "St." vs "Saint", etc.)
  const norm = normalizeTeamStr(teamName);
  for (const [name, id] of ncaabTeamEspnIds) {
    if (normalizeTeamStr(name) === norm) return id;
  }
  // Partial match (includes both ways) for Odds API vs ESPN name differences
  for (const [name, id] of ncaabTeamEspnIds) {
    if (name.includes(lower) || lower.includes(name)) return id;
  }
  return undefined;
}

export function teamLogoUrl(teamName: string): string {
  // 1. NCAAB exact match first — avoids tricode collisions (e.g. "Houston Cougars" → "HOU" → Rockets)
  const ncaabExact = ncaabTeamEspnIds.get(teamName.toLowerCase());
  if (ncaabExact) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${ncaabExact}.png`;
  }

  // 2. NBA / EPL via tricode
  const code = teamTricode(teamName);
  const nbaId = TEAM_NBA_IDS[code];
  if (nbaId) {
    return `https://cdn.nba.com/logos/nba/${nbaId}/global/L/logo.svg`;
  }
  const eplId = EPL_TEAM_IDS[code];
  if (eplId) {
    return `https://media.api-sports.io/football/teams/${eplId}.png`;
  }

  // 3. NCAAB partial match as fallback
  const ncaabPartial = getNcaabEspnTeamId(teamName);
  if (ncaabPartial) {
    return `https://a.espncdn.com/i/teamlogos/ncaa/500/${ncaabPartial}.png`;
  }
  return "";
}

export const CATEGORY_LABELS: Record<StatCategory, string> = {
  points: "Points",
  rebounds: "Rebounds",
  assists: "Assists",
  threes: "3PM",
  blocks: "Blocks",
  steals: "Steals",
  turnovers: "Turnovers",
  pra: "Pts+Reb+Ast",
  pts_reb: "Pts+Reb",
  pts_ast: "Pts+Ast",
  reb_ast: "Reb+Ast",
  blk_stl: "Blk+Stl",
  // Soccer
  shots: "Shots",
  shots_on_target: "Shots on Target",
  tackles: "Tackles",
  passes: "Passes",
  goals: "Goals",
  fouls_committed: "Fouls",
  saves: "Saves",
};

export const CATEGORY_COLORS: Record<StatCategory, string> = {
  points: "bg-orange-500/20 text-orange-400",
  rebounds: "bg-blue-500/20 text-blue-400",
  assists: "bg-green-500/20 text-green-400",
  threes: "bg-purple-500/20 text-purple-400",
  blocks: "bg-red-500/20 text-red-400",
  steals: "bg-yellow-500/20 text-yellow-400",
  turnovers: "bg-gray-500/20 text-gray-400",
  pra: "bg-pink-500/20 text-pink-400",
  pts_reb: "bg-teal-500/20 text-teal-400",
  pts_ast: "bg-lime-500/20 text-lime-400",
  reb_ast: "bg-cyan-500/20 text-cyan-400",
  blk_stl: "bg-rose-500/20 text-rose-400",
  // Soccer
  shots: "bg-orange-500/20 text-orange-400",
  shots_on_target: "bg-red-500/20 text-red-400",
  tackles: "bg-yellow-500/20 text-yellow-400",
  passes: "bg-blue-500/20 text-blue-400",
  goals: "bg-green-500/20 text-green-400",
  fouls_committed: "bg-gray-500/20 text-gray-400",
  saves: "bg-purple-500/20 text-purple-400",
};
