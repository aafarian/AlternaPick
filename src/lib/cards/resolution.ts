import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getCardResolvedEmailProps } from "@/lib/email/templates/card-resolved";
import { getCardTier } from "@/lib/cards/tiers";
import { logError } from "@/lib/logger";
import {
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import { getBoxscoreFetcher } from "@/lib/sports/fetchers";
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
  challenge_id: string | null;
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
      logError("resolution", `Unknown stat category: ${category}`);
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

/** Returns true when the game's commence_time is in the past (safe to treat as played). */
function hasGameStarted(commenceTime: string | null | undefined): boolean {
  if (!commenceTime) return true; // no time recorded → assume past game
  return new Date(commenceTime).getTime() <= Date.now();
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
    // All games must be final and started. If a pick is missing its
    // external_event_id we can still resolve the card — the pick will be
    // marked as "push" in resolveCard() since we can't fetch boxscore data.
    const allResolvable = card.picks.every(
      (pick) =>
        pick.props?.games?.status === "final" &&
        hasGameStarted(pick.props?.games?.commence_time)
    );
    if (!allResolvable) continue;

    const result = await resolveCard(card, boxscoreCache);
    if (result) {
      const resolved = await persistResolution(supabase, result);
      if (!resolved) continue; // Already resolved by another caller

      if (result.total > 0) {
        await handlePostResolution(supabase, result);
      } else if (result.user_id) {
        // All picks DNP/voided — still notify the user their card resolved
        await createNotification(supabase, {
          user_id: result.user_id,
          type: "card_resolved",
          title: "No Contest",
          body: "Your card resolved with no scoreable picks.",
          metadata: { card_id: result.card_id },
        }, null).catch(() => {});
      }
      results.push(result);
    }
  }

  // Resolve eligible challenges if any cards were resolved
  if (results.length > 0) {
    try {
      await resolveEligibleChallenges();
    } catch (err) {
      logError("resolution", `Failed to resolve challenges: ${err}`);
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

  // Find resolved cards that have picks with null actual_value.
  // Include "dnp" so false-DNP picks (transient ESPN data) can be corrected.
  const { data: stalePicks, error } = await (supabase.from("picks") as any)
    .select("id, card_id, selection, result, prop_id, props(player_name, stat_category, line, game_id, games(external_event_id, sport, status, commence_time))")
    .is("actual_value", null)
    .in("result", ["hit", "miss", "dnp"]);

  if (error) {
    logError("resolution", `Failed to fetch stale picks: ${error.message}`);
    return { picksUpdated: 0, cardsRescored: 0 };
  }
  if (!stalePicks || stalePicks.length === 0) {
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
      games: { external_event_id: string | null; sport: string | null; status: string | null; commence_time: string | null };
    };
  };

  const allPicks = stalePicks as StalePick[];

  // Post-filter by 7-day recency to avoid unbounded re-evaluation of old DNP picks (B16/B17).
  // Include picks where commence_time is missing since we can't determine their age.
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const picks = allPicks.filter((pick) => {
    const ct = pick.props?.games?.commence_time;
    if (!ct) return true; // can't determine age — include
    return new Date(ct).getTime() >= recentCutoff;
  });

  // Cache boxscores per game to minimize API calls
  const boxscoreCache = new Map<string, PlayerBoxScore[]>();
  let picksUpdated = 0;
  const affectedCardIds = new Set<string>();
  const affectedUserIds = new Set<string>();

  for (const pick of picks) {
    const eventId = pick.props?.games?.external_event_id;
    if (!eventId) continue;
    if (pick.props?.games?.status !== "final") continue;

    let boxscore = boxscoreCache.get(eventId);
    if (!boxscore) {
      try {
        const fetcher = getBoxscoreFetcher(pick.props?.games?.sport);
        boxscore = await fetcher(eventId);
        boxscoreCache.set(eventId, boxscore);
      } catch {
        continue;
      }
    }

    const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);
    if (!playerStats) continue;

    // DNP handling
    if (playerStats.dnp) {
      if (pick.result === "dnp") {
        // Already correctly classified as DNP — no-op
        continue;
      }
      // Was hit/miss but player is actually DNP — reclassify
      const { error: updateErr } = await (supabase.from("picks") as any)
        .update({ actual_value: null, result: "dnp" })
        .eq("id", pick.id);
      if (updateErr) {
        logError("resolution", `Failed to update pick ${pick.id} to dnp: ${updateErr.message}`);
      }
      picksUpdated++;
      affectedCardIds.add(pick.card_id);
      continue;
    }

    // Player has stats — reclassify (handles dnp->hit/miss and hit<->miss corrections)
    const actualValue = extractStatValue(playerStats, pick.props.stat_category);

    let correctResult: PickResult;
    if (
      (pick.selection === "over" && actualValue > pick.props.line) ||
      (pick.selection === "under" && actualValue < pick.props.line)
    ) {
      correctResult = "hit";
    } else {
      correctResult = "miss";
    }

    const { error: updateErr } = await (supabase.from("picks") as any)
      .update({ actual_value: actualValue, result: correctResult })
      .eq("id", pick.id);
    if (updateErr) {
      logError("resolution", `Failed to update pick ${pick.id}: ${updateErr.message}`);
    }

    picksUpdated++;
    affectedCardIds.add(pick.card_id);
  }

  // Re-score affected cards — update both score and total_picks
  let cardsRescored = 0;
  for (const cardId of affectedCardIds) {
    const { data: cardPicks, error: fetchErr } = await (supabase.from("picks") as any)
      .select("result, card_id, cards(user_id)")
      .eq("card_id", cardId);

    if (fetchErr) {
      logError("resolution", `Failed to fetch picks for card ${cardId}: ${fetchErr.message}`);
      continue;
    }
    if (!cardPicks) continue;

    const typedPicks = cardPicks as { result: string; cards: { user_id: string | null } }[];
    const newScore = typedPicks.filter((p) => p.result === "hit").length;
    const newTotal = typedPicks.filter((p) => p.result === "hit" || p.result === "miss").length;

    const { error: cardErr } = await (supabase.from("cards") as any)
      .update({ score: newScore, total_picks: newTotal })
      .eq("id", cardId);
    if (cardErr) {
      logError("resolution", `Failed to rescore card ${cardId}: ${cardErr.message}`);
    }

    // Track affected users for leaderboard recalculation
    const userId = typedPicks[0]?.cards?.user_id;
    if (userId) affectedUserIds.add(userId);

    cardsRescored++;
  }

  // Recalculate leaderboard for each affected user (B3)
  for (const userId of affectedUserIds) {
    try {
      await recalculateLeaderboard(supabase, userId);
    } catch (err) {
      logError("resolution", `Failed to recalculate leaderboard for user ${userId}: ${err}`);
    }
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
      // Can't resolve without external event ID — mark as push (void)
      // since we genuinely can't verify the outcome
      pickResolutions.push({
        pick_id: pick.id,
        prop_id: pick.prop_id,
        player_name: pick.props?.player_name ?? "Unknown",
        stat_category: pick.props?.stat_category ?? "points",
        line: pick.props?.line ?? 0,
        selection: pick.selection,
        actual_value: null,
        result: "push",
      });
      continue;
    }

    // Fetch boxscore (with cache) — use sport-aware endpoint
    let boxscore = boxscoreCache.get(eventId);
    if (!boxscore) {
      try {
        const fetcher = getBoxscoreFetcher(pick.props?.games?.sport);
        boxscore = await fetcher(eventId);
        boxscoreCache.set(eventId, boxscore);
      } catch {
        // Apply the same 48h safety valve as player-not-found. If the boxscore
        // endpoint is permanently broken for this event, void all remaining picks
        // as push so the card doesn't stay locked forever.
        const gameTime = pick.props?.games?.commence_time;
        const hrsAgo = gameTime
          ? (Date.now() - new Date(gameTime).getTime()) / (1000 * 60 * 60)
          : null;

        if (hrsAgo !== null && hrsAgo > 48) {
          logError("resolution", `Boxscore fetch failed after ${Math.round(hrsAgo)}h for event ${eventId}, voiding remaining picks on card ${card.id}`);
          for (const remainingPick of card.picks.slice(card.picks.indexOf(pick))) {
            pickResolutions.push({
              pick_id: remainingPick.id,
              prop_id: remainingPick.prop_id,
              player_name: remainingPick.props.player_name,
              stat_category: remainingPick.props.stat_category,
              line: remainingPick.props?.line ?? 0,
              selection: remainingPick.selection,
              actual_value: null,
              result: "push",
            });
          }
          break; // exit pick loop, resolve the card with what we have
        }

        logError("resolution", `Boxscore fetch failed for event ${eventId}, retrying card ${card.id}`);
        return null;
      }
    }

    const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

    if (!playerStats) {
      const commenceTime = pick.props?.games?.commence_time;
      let hoursSinceGame: number | null = null;

      if (commenceTime) {
        hoursSinceGame = (Date.now() - new Date(commenceTime).getTime()) / (1000 * 60 * 60);
      } else {
        // No commence_time — we can't determine game age. Retry indefinitely
        // and rely on manual admin intervention if needed.
        logError("resolution", `Player "${pick.props.player_name}" not found and commence_time is null for card ${card.id}, game ${pick.props?.games?.id ?? "unknown"}`);
        return null;
      }

      if (hoursSinceGame > 48) {
        // 48h since game start — void as push to prevent indefinite blocking
        logError("resolution", `Player "${pick.props.player_name}" not found after ${Math.round(hoursSinceGame)}h for card ${card.id}, voiding as push`);
        pickResolutions.push({
          pick_id: pick.id,
          prop_id: pick.prop_id,
          player_name: pick.props.player_name,
          stat_category: pick.props.stat_category,
          line: pick.props.line,
          selection: pick.selection,
          actual_value: null,
          result: "push",
        });
        continue;
      }

      // Transient — ESPN data may not be available yet. Retry next cycle.
      logError("resolution", `Player "${pick.props.player_name}" not found in boxscore for card ${card.id}, retrying (${Math.round(hoursSinceGame)}h since game)`);
      return null;
    }

    // DNP detection — player is on the roster but didn't play
    if (playerStats.dnp) {
      pickResolutions.push({
        pick_id: pick.id,
        prop_id: pick.prop_id,
        player_name: pick.props.player_name,
        stat_category: pick.props.stat_category,
        line: pick.props.line,
        selection: pick.selection,
        actual_value: null,
        result: "dnp",
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
  const scoredTotal = pickResolutions.filter((p) => p.result === "hit" || p.result === "miss").length;

  return {
    card_id: card.id,
    user_id: card.user_id,
    challenge_id: card.challenge_id ?? null,
    score,
    total: scoredTotal,
    picks: pickResolutions,
  };
}

async function persistResolution(
  supabase: ReturnType<typeof createAdminClient>,
  result: ResolutionResult
): Promise<boolean> {
  // Try atomic RPC first (single transaction for all picks + card status)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: success, error } = await (supabase.rpc as any)("resolve_card", {
    p_card_id: result.card_id,
    p_score: result.score,
    p_total: result.total,
    p_picks: result.picks.map((p) => ({
      pick_id: p.pick_id,
      result: p.result,
      actual_value: p.actual_value,
    })),
  });

  if (!error && success) {
    // RPC succeeded — update leaderboard (skip for all-DNP/push cards)
    if (result.user_id && result.total > 0) {
      await updateLeaderboardStats(supabase, result.user_id, result.score, result.total);
    }
    return true;
  }

  // Already resolved by another caller — no-op
  if (!error && !success) return false;
  if (error?.message?.includes("not found") || error?.message?.includes("locked")) {
    return false;
  }

  // RPC failed for another reason — fall back to direct writes
  logError("resolution", `resolve_card RPC failed, falling back to direct writes: ${error?.message}`);

  // Verify card is still locked
  const { data: check } = await (supabase.from("cards") as any)
    .select("status")
    .eq("id", result.card_id)
    .single();
  if (check?.status !== "locked") return false;

  // Write pick results
  for (const p of result.picks) {
    const { error: pickError } = await (supabase.from("picks") as any)
      .update({ result: p.result, actual_value: p.actual_value })
      .eq("id", p.pick_id);
    if (pickError) {
      logError("resolution", `Failed to write pick ${p.pick_id}: ${pickError.message}`);
    }
  }

  // Mark card resolved (only if still locked — race protection)
  const { data: updated } = await (supabase.from("cards") as any)
    .update({ status: "resolved", score: result.score, total_picks: result.total, resolved_at: new Date().toISOString() })
    .eq("id", result.card_id)
    .eq("status", "locked")
    .select("id");

  if (!updated?.length) return false;

  // Update leaderboard stats (skip for all-DNP/push cards)
  if (result.user_id && result.total > 0) {
    await updateLeaderboardStats(supabase, result.user_id, result.score, result.total);
  }

  return true;
}

/**
 * Post-resolution side effects: notification + achievement check.
 * Shared by resolveEligibleCards and tryResolveFromLiveData.
 */
async function handlePostResolution(
  supabase: ReturnType<typeof createAdminClient>,
  result: ResolutionResult,
): Promise<void> {
  if (!result.user_id) return;

  // Fetch profile with notification preferences (used by both notification + email)
  let profile: { email: string | null; username: string | null; notification_preferences: import("@/lib/supabase/types").NotificationPreferences | null } | null = null;
  try {
    const { data } = await (supabase.from("profiles") as any)
      .select("email, username, notification_preferences")
      .eq("id", result.user_id)
      .single();
    profile = data;
  } catch (profileError) {
    logError("card-resolution", `Failed to fetch profile for notification/email: ${profileError}`);
  }

  try {
    const { title, body } = getCardNotificationMessage(result.score, result.total);
    await createNotification(supabase, {
      user_id: result.user_id,
      type: "card_resolved",
      title,
      body,
      metadata: { card_id: result.card_id },
    }, profile?.notification_preferences);
  } catch (notifError) {
    logError("card-resolution", `Failed to create card_resolved notification: ${notifError}`);
  }

  // Send card-resolved email (fire-and-forget, never blocks resolution).
  // Skip if this card belongs to a challenge — challenge_resolved email handles that.
  if (!result.challenge_id) {
    try {
      if (profile?.email && shouldSendEmail("card_resolved", profile.notification_preferences)) {
        const { subject, react } = getCardResolvedEmailProps({
          username: profile.username ?? "Player",
          score: result.score,
          total: result.total,
          cardId: result.card_id,
        });
        sendEmail({ to: profile.email, subject, react }).catch(() => {});
      }
    } catch (emailError) {
      logError("card-resolution", `Failed to send card_resolved email: ${emailError}`);
    }
  }

  try {
    const lbResult = await (supabase.from("leaderboard_entries") as any)
      .select("total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses")
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
    logError("card-resolution", `Failed to check achievements after card resolution: ${achievementError}`);
  }
}

function getCardNotificationMessage(
  score: number,
  total: number
): { title: string; body: string } {
  const { headline, subtext } = getCardTier(score, total);
  return {
    title: headline,
    body: `${score === 0 ? "0" : score} ${score === total ? `for ${total}` : `out of ${total} hits`}. ${subtext}`,
  };
}

/**
 * Recalculates leaderboard stats from scratch for a given user.
 * Used by reResolveStaleCards when picks are reclassified.
 *
 * NOTE: This does NOT recalculate current_streak or best_streak — those depend
 * on chronological card resolution order which is expensive to reconstruct.
 * Streaks are a known limitation and will be addressed in a follow-up.
 */
async function recalculateLeaderboard(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  // Fetch all resolved cards with scoreable picks (total_picks > 0)
  const { data: cards, error } = await (supabase.from("cards") as any)
    .select("score, total_picks")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .gt("total_picks", 0)
    .limit(10000);

  if (error) {
    logError("resolution", `recalculateLeaderboard: failed to fetch cards for user ${userId}: ${error.message}`);
    return;
  }
  if (!cards) return;

  const typedCards = cards as { score: number; total_picks: number }[];

  if (typedCards.length >= 10000) {
    logError("resolution", `recalculateLeaderboard: hit 10000-row cap for user ${userId} — stats may be truncated`);
  }

  const totalCards = typedCards.length;
  const totalCorrectPicks = typedCards.reduce((sum, c) => sum + c.score, 0);
  const totalAttemptedPicks = typedCards.reduce((sum, c) => sum + c.total_picks, 0);
  const winRate =
    totalAttemptedPicks > 0
      ? Math.round((totalCorrectPicks / totalAttemptedPicks) * 100 * 100) / 100
      : 0;

  // Try update first; if no rows matched, insert a new entry.
  // Preserves h2h stats and streaks (not recalculated here).
  const { data: updated, error: updateErr } = await (supabase.from("leaderboard_entries") as any)
    .update({
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id");

  if (updateErr) {
    logError("resolution", `recalculateLeaderboard: update failed for user ${userId}: ${updateErr.message}`);
    return;
  }

  // If no rows were updated, insert a new entry
  if (!updated || updated.length === 0) {
    const { error: insertErr } = await (supabase.from("leaderboard_entries") as any).insert({
      user_id: userId,
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      current_streak: 0,
      best_streak: 0,
      h2h_wins: 0,
      h2h_losses: 0,
    });
    if (insertErr) {
      logError("resolution", `recalculateLeaderboard: insert failed for user ${userId}: ${insertErr.message}`);
    }
  }
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

  if (existingResult.error) {
    if (existingResult.error.code === "PGRST116") {
      // No existing leaderboard row — new user, will be created below
    } else {
      logError("resolution", `updateLeaderboardStats: failed to fetch entry for user ${userId}: ${existingResult.error.message}`);
    }
  }

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
    const { error: updateErr } = await (supabase.from("leaderboard_entries") as any)
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
    if (updateErr) {
      logError("resolution", `updateLeaderboardStats: update failed for user ${userId}: ${updateErr.message}`);
    }
  } else {
    // Create new entry via insert (preserves default h2h values)
    const { error: insertErr } = await (supabase.from("leaderboard_entries") as any).insert({
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
    if (insertErr) {
      logError("resolution", `updateLeaderboardStats: insert failed for user ${userId}: ${insertErr.message}`);
    }
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
      // Safety: never treat a future game as final
      if (!hasGameStarted(pick.props?.games?.commence_time)) return false;
      const eventId = pick.props?.games?.external_event_id;
      if (eventId) {
        const liveGame = gameStatusMap.get(eventId);
        if (liveGame) return liveGame.status === "final";
      }
      // Game not in today's live data or has no event ID — trust DB status.
      return pick.props?.games?.status === "final";
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
    const { error: gameErr } = await (supabase.from("games") as any)
      .update({
        status: "final",
        external_event_id: liveGame.game_id,
        home_score: liveGame.home_score,
        away_score: liveGame.away_score,
      })
      .eq("id", dbGameId);
    if (gameErr) {
      logError("resolution", `Failed to update game ${dbGameId}: ${gameErr.message}`);
    }
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

    if (result.total > 0) {
      await handlePostResolution(supabase, result);
    } else if (result.user_id) {
      await createNotification(supabase, {
        user_id: result.user_id,
        type: "card_resolved",
        title: "No Contest",
        body: "Your card resolved with no scoreable picks.",
        metadata: { card_id: result.card_id },
      }, null).catch(() => {});
    }
    results.push(result);
  }

  // Step 5: Resolve eligible challenges if any cards were resolved
  if (results.length > 0) {
    try {
      await resolveEligibleChallenges();
    } catch (err) {
      logError("resolution", `Failed to resolve challenges: ${err}`);
    }
  }

  // Step 6: Re-resolve stale cards as cleanup (only if we just resolved something)
  if (results.length > 0) {
    try {
      await reResolveStaleCards();
    } catch (err) {
      logError("resolution", `Failed to re-resolve stale cards: ${err}`);
    }
  }

  return results;
}
