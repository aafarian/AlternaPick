import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { badRequest, handleApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeHeatScore,
  computeQualityBonus,
  getNotchTier,
} from "@/lib/heatscore/compute";
import type { PickResult, PickSelection, StatCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimPickRow {
  id: string;
  selection: PickSelection;
  result: PickResult;
  actual_value: number | null;
  notch: number;
  adjusted_line: number | null;
  prop: {
    player_name: string;
    stat_category: StatCategory;
    line: number;
  };
}

interface SimCardRow {
  id: string;
  user_id: string | null;
  score: number;
  total_picks: number;
  card_size: number;
  heat_score: number | null;
  status: string;
}

interface PlayerCardSim {
  userId: string | null;
  username: string | null;
  cardId: string;
  score: number;
  totalPicks: number;
  heatScore: number;
  qualityBonus: number;
  picks: Array<{
    playerName: string;
    statCategory: StatCategory;
    line: number;
    selection: PickSelection;
    result: PickResult;
    actualValue: number | null;
    notch: number;
    qualityTokens: number;
  }>;
}

/**
 * POST /api/admin/heatscore/simulate-challenge
 *
 * Simulate HeatScore for all cards in a challenge. Shows each player's
 * card with per-pick quality breakdown and who would win with tiebreaker.
 *
 * Body: { challenge_id: string }
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const body = await request.json();
    const challengeId = body?.challenge_id;

    if (!challengeId || typeof challengeId !== "string") {
      return badRequest("challenge_id is required");
    }

    const supabase = createAdminClient();

    // Fetch challenge
    const { data: challenge, error: challengeError } = await (supabase.from("challenges") as any)
      .select("id, status, winner_id, challenger_id, opponent_id")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
    }

    // Fetch all cards for this challenge
    const { data: cardsData } = await (supabase.from("cards") as any)
      .select("id, user_id, score, total_picks, card_size, heat_score, status")
      .eq("challenge_id", challengeId);

    const cards = (cardsData ?? []) as SimCardRow[];

    if (cards.length === 0) {
      return badRequest("No cards found for this challenge");
    }

    // Fetch profiles for usernames
    const userIds = cards.map((c) => c.user_id).filter(Boolean) as string[];
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, username")
      .in("id", userIds);
    const profileMap = new Map((profiles ?? []).map((p: { id: string; username: string }) => [p.id, p.username]));

    // Simulate each card
    const playerCards: PlayerCardSim[] = [];

    for (const card of cards) {
      if (card.status !== "resolved") {
        playerCards.push({
          userId: card.user_id,
          username: card.user_id ? (profileMap.get(card.user_id) as string) ?? null : null,
          cardId: card.id,
          score: card.score,
          totalPicks: card.total_picks,
          heatScore: 0,
          qualityBonus: 0,
          picks: [],
        });
        continue;
      }

      // Fetch picks with props
      const { data: picksData } = await (supabase.from("picks") as any)
        .select("id, selection, result, actual_value, notch, adjusted_line, prop:props!inner(player_name, stat_category, line)")
        .eq("card_id", card.id);

      const picks = (picksData ?? []) as SimPickRow[];

      const hitCount = picks.filter((p) => p.result === "hit").length;
      const missCount = picks.filter((p) => p.result === "miss").length;

      const qualityResult = computeQualityBonus(
        picks.map((p) => ({
          actualValue: p.actual_value,
          line: p.adjusted_line ?? p.prop.line,
          selection: p.selection,
          result: p.result,
          notchMultiplier: getNotchTier(p.notch ?? 0).multiplier,
        })),
      );

      // Per-pick additive HeatScore (no multiplier table, no bust)
      const rawHeatScore = computeHeatScore(
        picks.map((p, i) => ({
          result: p.result,
          notchMultiplier: getNotchTier(p.notch ?? 0).multiplier,
          qualityTokens: qualityResult.perPick[i],
        })),
      );

      playerCards.push({
        userId: card.user_id,
        username: card.user_id ? (profileMap.get(card.user_id) as string) ?? null : null,
        cardId: card.id,
        score: hitCount,
        totalPicks: hitCount + missCount,
        heatScore: rawHeatScore,
        qualityBonus: qualityResult.total,
        picks: picks.map((p, i) => ({
          playerName: p.prop.player_name,
          statCategory: p.prop.stat_category,
          line: p.adjusted_line ?? p.prop.line,
          selection: p.selection,
          result: p.result,
          actualValue: p.actual_value,
          notch: p.notch ?? 0,
          qualityTokens: qualityResult.perPick[i],
        })),
      });
    }

    // Sort by score DESC, then HeatScore DESC (same as challenge resolution)
    playerCards.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.heatScore - a.heatScore;
    });

    // Determine simulated winner
    const topScore = playerCards[0]?.score ?? 0;
    const topHS = playerCards[0]?.heatScore ?? 0;
    const tiedAtTop = playerCards.filter((c) => c.score === topScore && c.heatScore === topHS).length > 1;
    const simulatedWinner = tiedAtTop ? null : playerCards[0]?.userId ?? null;

    return NextResponse.json({
      challengeId,
      status: challenge.status,
      actualWinner: challenge.winner_id,
      simulatedWinner,
      simulatedWinnerUsername: simulatedWinner ? (profileMap.get(simulatedWinner) as string) ?? null : null,
      players: playerCards,
    });
  } catch (error) {
    return handleApiError(error, "admin/heatscore/simulate-challenge");
  }
}
