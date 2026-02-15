import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
import {
  fetchBoxscore,
  fetchSoccerBoxscore,
  fetchNcaabBoxscore,
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import type { PickWithPropAndGame } from "@/lib/cards/live-computation";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
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
  props: Prop & { games: Game & { sport?: string } };
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

  // Cache boxscores per ESPN event ID to minimize API calls
  const boxscoreCache = new Map<string, PlayerBoxScore[]>();

  for (const card of cards) {
    // Check if all games are final AND have an external event ID.
    // Without it we can't fetch boxscore data, so skip the card
    // and let sync-status set the ID on a future run (e.g. via yesterday check).
    const allResolvable = card.picks.every(
      (pick) =>
        pick.props?.games?.status === "final" &&
        pick.props?.games?.external_event_id
    );
    if (!allResolvable) continue;

    const result = await resolveCard(card, boxscoreCache);
    if (result) {
      const resolved = await persistResolution(supabase, result);
      if (!resolved) continue; // Already resolved by another caller

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

/**
 * Re-resolve picks on already-resolved cards that have null actual_value.
 * This handles cases where resolution ran before boxscore data was available
 * on ESPN (common with NCAAB games that just ended).
 */
export async function reResolveStaleCards(): Promise<{
  picksUpdated: number;
  cardsRescored: number;
}> {
  const supabase = createAdminClient();

  // Find resolved cards that have picks with null actual_value
  const { data: stalePicks, error } = await (supabase.from("picks") as any)
    .select("id, card_id, selection, result, prop_id, props(player_name, stat_category, line, game_id, games(external_event_id, sport, status))")
    .is("actual_value", null)
    .in("result", ["hit", "miss"]);

  if (error || !stalePicks || stalePicks.length === 0) {
    return { picksUpdated: 0, cardsRescored: 0 };
  }

  type StalePick = {
    id: string;
    card_id: string;
    selection: "over" | "under";
    result: string;
    prop_id: string;
    props: {
      player_name: string;
      stat_category: StatCategory;
      line: number;
      game_id: string;
      games: { external_event_id: string | null; sport: string | null; status: string | null };
    };
  };

  const picks = stalePicks as StalePick[];

  // Cache boxscores per game to minimize API calls
  const boxscoreCache = new Map<string, PlayerBoxScore[]>();
  let picksUpdated = 0;
  const affectedCardIds = new Set<string>();

  for (const pick of picks) {
    const eventId = pick.props?.games?.external_event_id;
    if (!eventId) continue;
    if (pick.props?.games?.status !== "final") continue;

    let boxscore = boxscoreCache.get(eventId);
    if (!boxscore) {
      try {
        const sport = pick.props?.games?.sport;
        if (sport === "epl") {
          boxscore = await fetchSoccerBoxscore(eventId);
        } else if (sport === "ncaab") {
          boxscore = await fetchNcaabBoxscore(eventId);
        } else {
          boxscore = await fetchBoxscore(eventId);
        }
        boxscoreCache.set(eventId, boxscore);
      } catch {
        continue;
      }
    }

    const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);
    if (!playerStats) continue;

    const actualValue = extractStatValue(playerStats, pick.props.stat_category);

    // Determine correct result — push (actualValue === line) is treated as miss
    // (see resolveCard comment for rationale on half-point lines)
    let correctResult: PickResult;
    if (
      (pick.selection === "over" && actualValue > pick.props.line) ||
      (pick.selection === "under" && actualValue < pick.props.line)
    ) {
      correctResult = "hit";
    } else {
      correctResult = "miss";
    }

    await (supabase.from("picks") as any)
      .update({ actual_value: actualValue, result: correctResult })
      .eq("id", pick.id);

    picksUpdated++;
    affectedCardIds.add(pick.card_id);
  }

  // Re-score affected cards
  let cardsRescored = 0;
  for (const cardId of affectedCardIds) {
    const { data: cardPicks } = await (supabase.from("picks") as any)
      .select("result")
      .eq("card_id", cardId);

    if (!cardPicks) continue;
    const allPicks = cardPicks as { result: string }[];
    const newScore = allPicks.filter((p) => p.result === "hit").length;

    await (supabase.from("cards") as any)
      .update({ score: newScore })
      .eq("id", cardId);

    cardsRescored++;
  }

  return { picksUpdated, cardsRescored };
}

export async function resolveCard(
  card: Card & { picks: PickWithProp[] },
  boxscoreCache: Map<string, PlayerBoxScore[]>
): Promise<ResolutionResult | null> {
  const pickResolutions: PickResolution[] = [];

  for (const pick of card.picks) {
    const eventId = pick.props?.games?.external_event_id;
    if (!eventId) {
      // Can't resolve without external event ID - mark as miss
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

    // Fetch boxscore (with cache) — use sport-aware endpoint
    let boxscore = boxscoreCache.get(eventId);
    if (!boxscore) {
      try {
        const gameSport = pick.props?.games?.sport;
        if (gameSport === "epl") {
          boxscore = await fetchSoccerBoxscore(eventId);
        } else if (gameSport === "ncaab") {
          boxscore = await fetchNcaabBoxscore(eventId);
        } else {
          boxscore = await fetchBoxscore(eventId);
        }
        boxscoreCache.set(eventId, boxscore);
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
      // Push (actualValue === line) falls through to "miss". This is intentional:
      // consensus lines are forced to half-point values (e.g. 18.0 → 18.5) making
      // pushes against integer stat values impossible in practice.
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
): Promise<boolean> {
  // Atomic resolution: updates all picks + card status in a single transaction.
  // Returns false if the card was already resolved (race condition).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: success, error } = await (supabase.rpc as any)("resolve_card", {
    p_card_id: result.card_id,
    p_score: result.score,
    p_picks: result.picks.map((p) => ({
      pick_id: p.pick_id,
      result: p.result,
      actual_value: p.actual_value,
    })),
  });

  if (error) {
    // Card not in 'locked' status — already resolved by another caller
    if (error.message?.includes("not found") || error.message?.includes("locked")) {
      return false;
    }
    throw error;
  }

  if (!success) {
    // Card was already resolved (race condition) — skip leaderboard update
    return false;
  }

  // Update leaderboard stats for authenticated users
  if (result.user_id) {
    await updateLeaderboardStats(
      supabase,
      result.user_id,
      result.score,
      result.total
    );
  }

  return true;
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

/**
 * Resolve cards instantly using data already fetched by the live endpoint.
 * No extra ESPN API calls — reuses the pre-fetched boxscores.
 *
 * Called from the live polling endpoints so cards resolve within ~30s
 * of the last game ending (the next poll cycle).
 */
export async function tryResolveFromLiveData(
  cards: Array<{ id: string; status: string; picks: PickWithPropAndGame[] }>,
  gameStatusMap: Map<string, StatsGame>,
  boxscoreMap: Map<string, PlayerBoxScore[]>,
): Promise<ResolutionResult[]> {
  // Step 1: Find locked cards where ALL picks' games are final in live data
  const eligibleCardIds: string[] = [];
  const gameUpdates = new Map<string, StatsGame>();

  for (const card of cards) {
    if (card.status !== "locked") continue;

    const allFinal = card.picks.every((pick) => {
      const eventId = pick.props?.games?.external_event_id;
      if (!eventId) return false;
      const liveGame = gameStatusMap.get(eventId);
      if (liveGame) return liveGame.status === "final";
      // Not in today's games — treat as final (same as buildLivePicksForCard fallback)
      return true;
    });

    if (!allFinal) continue;
    eligibleCardIds.push(card.id);

    // Collect game rows to update (deduped by DB game_id)
    for (const pick of card.picks) {
      const eventId = pick.props?.games?.external_event_id;
      if (!eventId) continue;
      const liveGame = gameStatusMap.get(eventId);
      if (liveGame && !gameUpdates.has(pick.props.game_id)) {
        gameUpdates.set(pick.props.game_id, liveGame);
      }
    }
  }

  if (eligibleCardIds.length === 0) return [];

  const supabase = createAdminClient();

  // Step 2: Update DB game rows with final status and scores
  for (const [dbGameId, liveGame] of gameUpdates) {
    await (supabase.from("games") as any)
      .update({
        status: "final",
        external_event_id: liveGame.game_id,
        home_score: liveGame.home_score,
        away_score: liveGame.away_score,
      })
      .eq("id", dbGameId);
  }

  // Step 3: Fetch full card data from DB (need user_id, prop_id, etc.)
  const cardsResult = await (supabase.from("cards") as any)
    .select("*, picks(*, props(*, games(*)))")
    .in("id", eligibleCardIds)
    .eq("status", "locked");

  if (cardsResult.error || !cardsResult.data) return [];

  const fullCards = cardsResult.data as (Card & { picks: PickWithProp[] })[];
  const results: ResolutionResult[] = [];

  // Step 4: Resolve each card, reusing pre-fetched boxscore data
  for (const card of fullCards) {
    const result = await resolveCard(card, boxscoreMap);
    if (!result) continue;

    const resolved = await persistResolution(supabase, result);
    if (!resolved) continue; // Already resolved by another caller

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

  // Step 5: Resolve eligible challenges if any cards were resolved
  if (results.length > 0) {
    try {
      await resolveEligibleChallenges();
    } catch (err) {
      console.error("Failed to resolve challenges:", err);
    }
  }

  // Step 6: Re-resolve stale cards as cleanup (only if we just resolved something)
  if (results.length > 0) {
    try {
      await reResolveStaleCards();
    } catch (err) {
      console.error("Failed to re-resolve stale cards:", err);
    }
  }

  return results;
}
