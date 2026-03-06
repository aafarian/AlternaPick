/**
 * Admin Resync Module
 *
 * Functions to rebuild derived stats from source-of-truth data:
 *   picks.result → cards.score/total_picks → leaderboard_entries → recaps
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { logError } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardScoreFix {
  cardId: string;
  oldScore: number;
  oldTotal: number;
  newScore: number;
  newTotal: number;
}

export interface ResyncCardScoresResult {
  cardsChecked: number;
  cardsFixed: number;
  fixes: CardScoreFix[];
}

export interface RebuildLeaderboardResult {
  userId: string;
  totalCards: number;
  totalCorrectPicks: number;
  totalAttemptedPicks: number;
  winRate: number;
  currentStreak: number;
  bestStreak: number;
  h2hWins: number;
  h2hLosses: number;
}

export interface RebuildAllResult {
  usersProcessed: number;
  usersErrored: number;
  errors: Array<{ userId: string; message: string }>;
}

// ---------------------------------------------------------------------------
// resyncCardScores
// ---------------------------------------------------------------------------

const CARD_BATCH_SIZE = 500;
const USER_BATCH_SIZE = 10;

/**
 * Recalculate score/total_picks for all resolved cards from actual pick results.
 * Only updates cards where stored values differ from computed values.
 */
export async function resyncCardScores(): Promise<ResyncCardScoresResult> {
  const supabase = createAdminClient();

  let cardsChecked = 0;
  let cardsFixed = 0;
  const fixes: CardScoreFix[] = [];

  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: cards, error } = await typedFrom(supabase, "cards")
      .select("id, score, total_picks")
      .eq("status", "resolved")
      .range(from, from + CARD_BATCH_SIZE - 1)
      .order("resolved_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch resolved cards: ${error.message}`);
    }

    if (!cards || cards.length === 0) {
      hasMore = false;
      break;
    }

    // Collect card IDs for this batch
    const cardIds = cards.map((c: { id: string }) => c.id);

    // Fetch all resolved picks for these cards in one query
    const { data: picks, error: picksErr } = await typedFrom(supabase, "picks")
      .select("card_id, result")
      .in("card_id", cardIds)
      .in("result", ["hit", "miss"]);

    if (picksErr) {
      throw new Error(`Failed to fetch picks: ${picksErr.message}`);
    }

    // Build a map: cardId -> { hits, total }
    const pickCounts = new Map<string, { hits: number; total: number }>();
    for (const pick of picks ?? []) {
      const counts = pickCounts.get(pick.card_id) ?? { hits: 0, total: 0 };
      counts.total += 1;
      if (pick.result === "hit") counts.hits += 1;
      pickCounts.set(pick.card_id, counts);
    }

    // Compare and collect mismatches
    const updatePromises: Promise<void>[] = [];

    for (const card of cards) {
      cardsChecked++;
      const counts = pickCounts.get(card.id) ?? { hits: 0, total: 0 };
      const newScore = counts.hits;
      const newTotal = counts.total;

      if (card.score !== newScore || card.total_picks !== newTotal) {
        fixes.push({
          cardId: card.id,
          oldScore: card.score,
          oldTotal: card.total_picks,
          newScore,
          newTotal,
        });
        cardsFixed++;

        updatePromises.push(
          typedFrom(supabase, "cards")
            .update({ score: newScore, total_picks: newTotal })
            .eq("id", card.id)
            .then(({ error: updateErr }: { error: { message: string } | null }) => {
              if (updateErr) {
                logError(
                  "resync",
                  `Failed to update card ${card.id}: ${updateErr.message}`,
                );
              }
            }),
        );
      }
    }

    // Batch all updates in parallel
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    from += cards.length;
    if (cards.length < CARD_BATCH_SIZE) hasMore = false;
  }

  return { cardsChecked, cardsFixed, fixes };
}

// ---------------------------------------------------------------------------
// rebuildUserLeaderboard
// ---------------------------------------------------------------------------

/**
 * Full stats rebuild for a single user from resolved cards + challenges.
 * Preserves daily_streak/best_daily_streak/last_played_date (managed by streaks engine).
 */
export async function rebuildUserLeaderboard(
  userId: string,
): Promise<RebuildLeaderboardResult> {
  const supabase = createAdminClient();
  return rebuildUserLeaderboardInternal(supabase, userId);
}

async function rebuildUserLeaderboardInternal(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<RebuildLeaderboardResult> {
  // Fetch all resolved cards for this user, ordered chronologically
  const { data: cards, error: cardsErr } = await typedFrom(supabase, "cards")
    .select("id, score, total_picks, resolved_at")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .order("resolved_at", { ascending: true });

  if (cardsErr) {
    throw new Error(
      `Failed to fetch cards for user ${userId}: ${cardsErr.message}`,
    );
  }

  // Walk chronologically to compute card-based stats + streaks
  let totalCards = 0;
  let totalCorrectPicks = 0;
  let totalAttemptedPicks = 0;
  let currentStreak = 0;
  let bestStreak = 0;

  for (const card of cards ?? []) {
    totalCards++;
    totalCorrectPicks += card.score ?? 0;
    totalAttemptedPicks += card.total_picks ?? 0;

    // Win threshold: >= 66% correct picks
    const winThreshold = Math.ceil((card.total_picks ?? 0) * 0.66);
    const isWin =
      (card.total_picks ?? 0) > 0 && (card.score ?? 0) >= winThreshold;

    currentStreak = isWin ? currentStreak + 1 : 0;
    bestStreak = Math.max(bestStreak, currentStreak);
  }

  const winRate =
    totalAttemptedPicks > 0
      ? Math.round((totalCorrectPicks / totalAttemptedPicks) * 100 * 100) / 100
      : 0;

  // Count H2H from challenges table directly
  const [winsResult, lossesResult] = await Promise.all([
    typedFrom(supabase, "challenges")
      .select("id", { count: "exact", head: true })
      .eq("winner_id", userId)
      .eq("status", "resolved"),
    typedFrom(supabase, "challenges")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved")
      .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
      .neq("winner_id", userId)
      .not("winner_id", "is", null),
  ]);

  const h2hWins = winsResult.count ?? 0;
  const h2hLosses = lossesResult.count ?? 0;

  // Upsert leaderboard entry, preserving daily streak fields
  const { error: upsertErr } = await typedFrom(
    supabase,
    "leaderboard_entries",
  ).upsert(
    {
      user_id: userId,
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      current_streak: currentStreak,
      best_streak: bestStreak,
      h2h_wins: h2hWins,
      h2h_losses: h2hLosses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id", ignoreDuplicates: false },
  );

  if (upsertErr) {
    throw new Error(
      `Failed to upsert leaderboard for ${userId}: ${upsertErr.message}`,
    );
  }

  return {
    userId,
    totalCards,
    totalCorrectPicks,
    totalAttemptedPicks,
    winRate,
    currentStreak,
    bestStreak,
    h2hWins,
    h2hLosses,
  };
}

// ---------------------------------------------------------------------------
// rebuildAllLeaderboards
// ---------------------------------------------------------------------------

/**
 * Rebuild leaderboard stats for every user with resolved cards.
 * Processes users in parallel batches for performance.
 * Errors are isolated per user — one failure doesn't abort all.
 */
export async function rebuildAllLeaderboards(): Promise<RebuildAllResult> {
  const supabase = createAdminClient();

  // Get distinct user IDs with resolved cards
  const { data: rows, error } = await typedFrom(supabase, "cards")
    .select("user_id")
    .eq("status", "resolved")
    .not("user_id", "is", null);

  if (error) {
    throw new Error(`Failed to fetch user IDs: ${error.message}`);
  }

  const userIds = [
    ...new Set((rows ?? []).map((r: { user_id: string }) => r.user_id)),
  ] as string[];

  let usersProcessed = 0;
  const errors: Array<{ userId: string; message: string }> = [];

  // Process in parallel batches
  for (let i = 0; i < userIds.length; i += USER_BATCH_SIZE) {
    const batch = userIds.slice(i, i + USER_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((userId) => rebuildUserLeaderboardInternal(supabase, userId)),
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled") {
        usersProcessed++;
      } else {
        const message =
          result.reason instanceof Error
            ? result.reason.message
            : "Unknown error";
        logError("resync", `Failed to rebuild leaderboard for ${batch[j]}`, undefined, result.reason);
        errors.push({ userId: batch[j], message });
      }
    }
  }

  return {
    usersProcessed,
    usersErrored: errors.length,
    errors,
  };
}
