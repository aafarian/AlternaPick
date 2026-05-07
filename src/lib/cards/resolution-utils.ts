import { logWarn } from "@/lib/logger";
import type { PlayerBoxScore } from "@/lib/stats-service/client";
import type { StatCategory } from "@/lib/supabase/types";

export function extractStatValue(
  stats: PlayerBoxScore,
  category: StatCategory
): number {
  switch (category) {
    case "points":
      return stats.points;
    case "rebounds":
      return stats.rebounds;
    case "assists":
      return stats.assists;
    case "threes":
      return stats.threes_made;
    case "blocks":
      return stats.blocks;
    case "steals":
      return stats.steals;
    case "turnovers":
      return stats.turnovers;
    case "pra":
      return stats.points + stats.rebounds + stats.assists;
    case "pts_reb":
      return stats.points + stats.rebounds;
    case "pts_ast":
      return stats.points + stats.assists;
    case "reb_ast":
      return stats.rebounds + stats.assists;
    case "blk_stl":
      return stats.blocks + stats.steals;
    // Soccer stats
    case "goals":
      return stats.goals ?? 0;
    case "shots":
      return stats.shots ?? 0;
    case "shots_on_target":
      return stats.shots_on_target ?? 0;
    case "tackles":
      return stats.tackles ?? 0;
    case "passes":
      return stats.passes ?? 0;
    case "fouls_committed":
      return stats.fouls_committed ?? 0;
    case "saves":
      return stats.saves ?? 0;
    // Baseball stats
    case "hits":
      return stats.hits ?? 0;
    case "home_runs":
      return stats.home_runs ?? 0;
    case "rbis":
      return stats.rbis ?? 0;
    case "runs":
      return stats.runs ?? 0;
    case "stolen_bases":
      return stats.stolen_bases ?? 0;
    case "total_bases":
      return stats.total_bases ?? 0;
    case "pitcher_strikeouts":
      return stats.pitcher_strikeouts ?? 0;
    case "pitcher_outs":
      return stats.pitcher_outs ?? 0;
    case "hits_runs_rbis":
      return stats.hits_runs_rbis ?? 0;
    default:
      logWarn("resolution", `Unknown stat category: ${category}`);
      return 0;
  }
}

/** Strip diacritics (ä→a, é→e, etc.) and lowercase for name matching. */
function normForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function fuzzyMatchPlayer(
  boxscore: PlayerBoxScore[],
  playerName: string
): PlayerBoxScore | undefined {
  const normalized = normForMatch(playerName);

  // Exact match (diacritics-insensitive)
  const exact = boxscore.find(
    (p) => normForMatch(p.player_name) === normalized
  );
  if (exact) return exact;

  // Last name match
  const lastName = normalized.split(" ").pop() ?? "";
  const lastNameMatches = boxscore.filter((p) =>
    normForMatch(p.player_name).includes(lastName)
  );
  if (lastNameMatches.length === 1) return lastNameMatches[0];

  // Partial match
  return boxscore.find((p) => {
    const norm = normForMatch(p.player_name);
    return norm.includes(normalized) || normalized.includes(norm);
  });
}
