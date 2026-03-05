import { NextRequest, NextResponse } from "next/server";
import { resolveEligibleCards, reResolveStaleCards } from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { resetWeeklyFreezes } from "@/lib/streaks/engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import { logError } from "@/lib/logger";

export async function POST(request: NextRequest) {
  // Auth check
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return unauthorized();
    }
  }

  try {
    // Fire-and-forget: replenish streak freezes on weekly cadence
    try {
      const adminClient = createAdminClient();
      await resetWeeklyFreezes(adminClient);
    } catch (freezeError) {
      logError("resolve", "Failed to reset weekly freezes", undefined, freezeError);
    }

    // Phase 1: Resolve eligible cards
    const results = await resolveEligibleCards();

    // Phase 1.5: Re-resolve stale picks (null actual_value on resolved cards)
    // Handles cases where boxscore data wasn't available at initial resolution.
    let reResolved = { picksUpdated: 0, cardsRescored: 0 };
    try {
      reResolved = await reResolveStaleCards();
    } catch (reResolveError) {
      logError("resolve", "Re-resolution failed", undefined, reResolveError);
    }

    // Phase 2: Resolve eligible challenges (post-processing)
    const challengeResults = await resolveEligibleChallenges();

    return NextResponse.json({
      resolved: results.length,
      results: results.map((r) => ({
        card_id: r.card_id,
        score: r.score,
        total: r.total,
        picks: r.picks.map((p) => ({
          player_name: p.player_name,
          stat_category: p.stat_category,
          line: p.line,
          selection: p.selection,
          actual_value: p.actual_value,
          result: p.result,
        })),
      })),
      re_resolved: reResolved,
      challenges_resolved: challengeResults.length,
      challenge_results: challengeResults.map((cr) => ({
        challenge_id: cr.challenge_id,
        winner_id: cr.winner_id,
        challenger_score: cr.challenger_score,
        opponent_score: cr.opponent_score,
        is_tie: cr.is_tie,
      })),
    });
  } catch (error) {
    return handleApiError(error, "Resolution failed");
  }
}
