import { NextRequest, NextResponse } from "next/server";
import { resolveEligibleCards } from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  // Auth check
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // Phase 1: Resolve eligible cards
    const results = await resolveEligibleCards();

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
