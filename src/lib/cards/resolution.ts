import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
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
  user_id: string | null;
  score: number;
  total: number;
  picks: PickResolution[];
}

type PickWithProp = Pick & {
  props: Prop & { games: Game };
};

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
    default:
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

export async function resolveEligibleCards(): Promise<ResolutionResult[]> {
  const supabase = createAdminClient();

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

      // Fire-and-forget: notify card owner about resolution
      if (result.user_id) {
        try {
          const { title, body } = getCardNotificationMessage(
            result.score,
            result.total
          );
          await createNotification(supabase, {
            user_id: result.user_id,
            type: "card_resolved",
            title,
            body,
            metadata: { card_id: result.card_id },
          });
        } catch (notifError) {
          console.error(
            "Failed to create card_resolved notification:",
            notifError
          );
        }

        // Fire-and-forget: check achievements after card resolution
        try {
          const lbResult = await (supabase.from("leaderboard_entries") as any)
            .select(
              "total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses"
            )
            .eq("user_id", result.user_id)
            .single();

          const lb = (lbResult.data ?? {
            total_cards: 0,
            current_streak: 0,
            best_streak: 0,
            win_rate: 0,
            h2h_wins: 0,
            h2h_losses: 0,
          }) as {
            total_cards: number;
            current_streak: number;
            best_streak: number;
            win_rate: number;
            h2h_wins: number;
            h2h_losses: number;
          };

          await checkAndUnlockAchievements(supabase, result.user_id, {
            cardResolved: { score: result.score, total: result.total },
            leaderboardStats: lb,
          });
        } catch (achievementError) {
          console.error(
            "Failed to check achievements after card resolution:",
            achievementError
          );
        }
      }

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
    user_id: card.user_id,
    score,
    total: pickResolutions.length,
    picks: pickResolutions,
  };
}

async function persistResolution(
  supabase: ReturnType<typeof createAdminClient>,
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

  // Update leaderboard stats for authenticated users
  if (result.user_id) {
    await updateLeaderboardStats(
      supabase,
      result.user_id,
      result.score,
      result.total
    );
  }
}

function getCardNotificationMessage(
  score: number,
  total: number
): { title: string; body: string } {
  const ratio = total > 0 ? score / total : 0;

  if (score === total) {
    return {
      title: "Perfect Card!",
      body: `You went ${score} for ${total}. Absolute masterclass.`,
    };
  }
  if (ratio >= 0.8) {
    return {
      title: "On Fire!",
      body: `${score} out of ${total} hits. Almost perfect.`,
    };
  }
  if (ratio >= 0.6) {
    return {
      title: "Nice Card!",
      body: `${score} out of ${total} hits. Solid work.`,
    };
  }
  if (ratio >= 0.4) {
    return {
      title: "Not Bad",
      body: `${score} out of ${total}. Room to improve.`,
    };
  }
  if (score > 0) {
    return {
      title: "Tough Break",
      body: `${score} out of ${total}. Shake it off.`,
    };
  }
  return {
    title: "Ice Cold",
    body: `0 for ${total}. Tomorrow's a new day.`,
  };
}

/**
 * Updates leaderboard_entries for a user after card resolution.
 * Increments total_cards, adds hits to total_correct_picks, tracks
 * total_attempted_picks, recalculates win_rate, and updates
 * current_streak / best_streak.
 *
 * A "winning" card requires >= 66% correct picks:
 *   threshold = Math.ceil(totalPicks * 0.66)
 *   2 picks -> need 2, 3 -> 2, 4 -> 3, 5 -> 4, 6 -> 4
 */
async function updateLeaderboardStats(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  score: number,
  totalPicks: number
): Promise<void> {
  const winThreshold = Math.ceil(totalPicks * 0.66);
  const isWin = totalPicks > 0 && score >= winThreshold;

  // Fetch existing entry
  const existingResult = await (supabase.from("leaderboard_entries") as any)
    .select(
      "total_cards, total_correct_picks, total_attempted_picks, current_streak, best_streak, h2h_wins, h2h_losses"
    )
    .eq("user_id", userId)
    .single();

  const existing = existingResult.data as {
    total_cards: number;
    total_correct_picks: number;
    total_attempted_picks: number;
    current_streak: number;
    best_streak: number;
    h2h_wins: number;
    h2h_losses: number;
  } | null;

  const totalCards = (existing?.total_cards ?? 0) + 1;
  const totalCorrectPicks = (existing?.total_correct_picks ?? 0) + score;
  const totalAttemptedPicks =
    (existing?.total_attempted_picks ?? 0) + totalPicks;
  const winRate =
    totalAttemptedPicks > 0
      ? Math.round((totalCorrectPicks / totalAttemptedPicks) * 100 * 100) / 100
      : 0;

  const currentStreak = isWin ? (existing?.current_streak ?? 0) + 1 : 0;
  const previousBest = existing?.best_streak ?? 0;
  const bestStreak = Math.max(previousBest, currentStreak);

  if (existing) {
    // Update existing entry -- preserve h2h stats
    await (supabase.from("leaderboard_entries") as any)
      .update({
        total_cards: totalCards,
        total_correct_picks: totalCorrectPicks,
        total_attempted_picks: totalAttemptedPicks,
        win_rate: winRate,
        current_streak: currentStreak,
        best_streak: bestStreak,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  } else {
    // Create new entry via insert (preserves default h2h values)
    await (supabase.from("leaderboard_entries") as any).insert({
      user_id: userId,
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      current_streak: currentStreak,
      best_streak: bestStreak,
      h2h_wins: 0,
      h2h_losses: 0,
    });
  }
}
