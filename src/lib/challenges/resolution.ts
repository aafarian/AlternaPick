import { createAdminClient } from "@/lib/supabase/admin";
import type { Card, Challenge } from "@/lib/supabase/types";

export interface ChallengeResolutionResult {
  challenge_id: string;
  winner_id: string | null;
  challenger_score: number;
  opponent_score: number;
  is_tie: boolean;
}

/**
 * Resolves all eligible challenges where both linked cards have been resolved.
 * Determines the winner by comparing card scores, updates the challenge row,
 * and updates h2h_wins/h2h_losses in leaderboard_entries.
 */
export async function resolveEligibleChallenges(): Promise<
  ChallengeResolutionResult[]
> {
  const supabase = createAdminClient();

  // Fetch all active challenges
  const challengesResult = await (supabase.from("challenges") as any)
    .select("*")
    .eq("status", "active");

  if (challengesResult.error) {
    throw new Error(
      `Failed to fetch challenges: ${challengesResult.error.message}`
    );
  }

  const challenges = challengesResult.data as Challenge[];
  const results: ChallengeResolutionResult[] = [];

  for (const challenge of challenges) {
    // Fetch both cards linked to this challenge
    const cardsResult = await (supabase.from("cards") as any)
      .select("*")
      .eq("challenge_id", challenge.id);

    if (cardsResult.error) {
      console.error(
        `Failed to fetch cards for challenge ${challenge.id}: ${cardsResult.error.message}`
      );
      continue;
    }

    const cards = cardsResult.data as Card[];

    // Need exactly 2 cards and both must be resolved
    if (cards.length !== 2) continue;
    if (!cards.every((c) => c.status === "resolved")) continue;

    // Determine which card belongs to challenger vs opponent
    const challengerCard = cards.find(
      (c) => c.user_id === challenge.challenger_id
    );
    const opponentCard = cards.find(
      (c) => c.user_id === challenge.opponent_id
    );

    if (!challengerCard || !opponentCard) continue;

    const challengerScore = challengerCard.score;
    const opponentScore = opponentCard.score;
    const isTie = challengerScore === opponentScore;

    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (!isTie) {
      winnerId =
        challengerScore > opponentScore
          ? challenge.challenger_id
          : challenge.opponent_id;
      loserId =
        winnerId === challenge.challenger_id
          ? challenge.opponent_id
          : challenge.challenger_id;
    }

    // Update challenge row
    const updateResult = await (supabase.from("challenges") as any)
      .update({
        status: "resolved",
        winner_id: winnerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", challenge.id);

    if (updateResult.error) {
      console.error(
        `Failed to update challenge ${challenge.id}: ${updateResult.error.message}`
      );
      continue;
    }

    // Update leaderboard H2H stats (only when there is a winner)
    if (winnerId && loserId) {
      await updateH2HStats(supabase, winnerId, loserId);
    }

    results.push({
      challenge_id: challenge.id,
      winner_id: winnerId,
      challenger_score: challengerScore,
      opponent_score: opponentScore,
      is_tie: isTie,
    });
  }

  return results;
}

/**
 * Updates h2h_wins for the winner and h2h_losses for the loser
 * in the leaderboard_entries table. Creates entries if they don't exist.
 */
async function updateH2HStats(
  supabase: ReturnType<typeof createAdminClient>,
  winnerId: string,
  loserId: string
): Promise<void> {
  // Update winner's h2h_wins
  const winnerEntry = await (supabase.from("leaderboard_entries") as any)
    .select("id, h2h_wins")
    .eq("user_id", winnerId)
    .single();

  if (winnerEntry.data) {
    await (supabase.from("leaderboard_entries") as any)
      .update({
        h2h_wins: (winnerEntry.data as { id: string; h2h_wins: number })
          .h2h_wins + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", winnerId);
  } else {
    // Create entry if it doesn't exist
    await (supabase.from("leaderboard_entries") as any).insert({
      user_id: winnerId,
      h2h_wins: 1,
      h2h_losses: 0,
      total_cards: 0,
      total_correct_picks: 0,
      win_rate: 0,
      current_streak: 0,
      best_streak: 0,
    });
  }

  // Update loser's h2h_losses
  const loserEntry = await (supabase.from("leaderboard_entries") as any)
    .select("id, h2h_losses")
    .eq("user_id", loserId)
    .single();

  if (loserEntry.data) {
    await (supabase.from("leaderboard_entries") as any)
      .update({
        h2h_losses: (loserEntry.data as { id: string; h2h_losses: number })
          .h2h_losses + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", loserId);
  } else {
    // Create entry if it doesn't exist
    await (supabase.from("leaderboard_entries") as any).insert({
      user_id: loserId,
      h2h_wins: 0,
      h2h_losses: 1,
      total_cards: 0,
      total_correct_picks: 0,
      win_rate: 0,
      current_streak: 0,
      best_streak: 0,
    });
  }
}
