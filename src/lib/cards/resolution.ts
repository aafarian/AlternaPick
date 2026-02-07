import { createClient } from "@/lib/supabase/server";
import {
  fetchBoxscore,
  type PlayerBoxScore,
} from "@/lib/stats-service/client";
import type {
  Card,
  Pick,
  Prop,
  Game,
  StatCategory,
  PickResult,
} from "@/lib/supabase/types";

export interface PickResolution {
  pick_id: string;
  prop_id: string;
  player_name: string;
  stat_category: StatCategory;
  line: number;
  selection: "over" | "under";
  actual_value: number | null;
  result: PickResult;
}

export interface ResolutionResult {
  card_id: string;
  score: number;
  total: number;
  picks: PickResolution[];
}

type PickWithProp = Pick & {
  props: Prop & { games: Game };
};

function extractStatValue(
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
    default:
      return 0;
  }
}

function fuzzyMatchPlayer(
  boxscore: PlayerBoxScore[],
  playerName: string
): PlayerBoxScore | undefined {
  const normalized = playerName.toLowerCase().trim();

  // Exact match
  const exact = boxscore.find(
    (p) => p.player_name.toLowerCase() === normalized
  );
  if (exact) return exact;

  // Last name match
  const lastName = normalized.split(" ").pop() ?? "";
  const lastNameMatches = boxscore.filter((p) =>
    p.player_name.toLowerCase().includes(lastName)
  );
  if (lastNameMatches.length === 1) return lastNameMatches[0];

  // Partial match
  return boxscore.find(
    (p) =>
      p.player_name.toLowerCase().includes(normalized) ||
      normalized.includes(p.player_name.toLowerCase())
  );
}

export async function resolveEligibleCards(): Promise<ResolutionResult[]> {
  const supabase = await createClient();

  // Get locked cards with their picks, props, and games
  const cardsResult = await (supabase.from("cards") as any)
    .select("*, picks(*, props(*, games(*)))")
    .eq("status", "locked");

  if (cardsResult.error) {
    throw new Error(`Failed to fetch cards: ${cardsResult.error.message}`);
  }

  const cards = cardsResult.data as (Card & { picks: PickWithProp[] })[];
  const results: ResolutionResult[] = [];

  // Cache boxscores per nba_game_id to minimize API calls
  const boxscoreCache = new Map<string, PlayerBoxScore[]>();

  for (const card of cards) {
    // Check if all games are final
    const allFinal = card.picks.every(
      (pick) => pick.props?.games?.status === "final"
    );
    if (!allFinal) continue;

    const result = await resolveCard(card, boxscoreCache);
    if (result) {
      await persistResolution(supabase, result);
      results.push(result);
    }
  }

  return results;
}

async function resolveCard(
  card: Card & { picks: PickWithProp[] },
  boxscoreCache: Map<string, PlayerBoxScore[]>
): Promise<ResolutionResult | null> {
  const pickResolutions: PickResolution[] = [];

  for (const pick of card.picks) {
    const nbaGameId = pick.props?.games?.nba_game_id;
    if (!nbaGameId) {
      // Can't resolve without nba_game_id - mark as miss
      pickResolutions.push({
        pick_id: pick.id,
        prop_id: pick.prop_id,
        player_name: pick.props?.player_name ?? "Unknown",
        stat_category: pick.props?.stat_category ?? "points",
        line: pick.props?.line ?? 0,
        selection: pick.selection,
        actual_value: null,
        result: "miss",
      });
      continue;
    }

    // Fetch boxscore (with cache)
    let boxscore = boxscoreCache.get(nbaGameId);
    if (!boxscore) {
      try {
        boxscore = await fetchBoxscore(nbaGameId);
        boxscoreCache.set(nbaGameId, boxscore);
      } catch {
        boxscore = [];
      }
    }

    const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

    if (!playerStats) {
      pickResolutions.push({
        pick_id: pick.id,
        prop_id: pick.prop_id,
        player_name: pick.props.player_name,
        stat_category: pick.props.stat_category,
        line: pick.props.line,
        selection: pick.selection,
        actual_value: null,
        result: "miss",
      });
      continue;
    }

    const actualValue = extractStatValue(
      playerStats,
      pick.props.stat_category
    );
    let result: PickResult;

    if (
      (pick.selection === "over" && actualValue > pick.props.line) ||
      (pick.selection === "under" && actualValue < pick.props.line)
    ) {
      result = "hit";
    } else {
      result = "miss";
    }

    pickResolutions.push({
      pick_id: pick.id,
      prop_id: pick.prop_id,
      player_name: pick.props.player_name,
      stat_category: pick.props.stat_category,
      line: pick.props.line,
      selection: pick.selection,
      actual_value: actualValue,
      result,
    });
  }

  const score = pickResolutions.filter((p) => p.result === "hit").length;

  return {
    card_id: card.id,
    score,
    total: pickResolutions.length,
    picks: pickResolutions,
  };
}

async function persistResolution(
  supabase: Awaited<ReturnType<typeof createClient>>,
  result: ResolutionResult
): Promise<void> {
  // Update each pick
  for (const pick of result.picks) {
    await (supabase.from("picks") as any)
      .update({
        result: pick.result,
        actual_value: pick.actual_value,
      })
      .eq("id", pick.pick_id);
  }

  // Update card
  await (supabase.from("cards") as any)
    .update({
      status: "resolved",
      score: result.score,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", result.card_id);
}
