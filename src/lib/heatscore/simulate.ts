import { createAdminClient } from "@/lib/supabase/admin";
import type { PickResult, PickSelection, StatCategory } from "@/lib/supabase/types";
import {
  impliedProbFromAmericanOdds,
  baseHeatScore,
  pickHeatScoreOnHit,
  pickHeatScoreOnMiss,
  computeCardHeatScore,
} from "./compute";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SimulatedPick {
  pickId: string;
  playerName: string;
  statCategory: StatCategory;
  originalLine: number;
  selection: PickSelection;
  result: PickResult;
  actualValue: number | null;
  overOdds: number | null;
  underOdds: number | null;
  impliedProb: number;
  baseHS: number;
  /** The notch-adjusted HeatScore earned on a hit (unsigned). */
  hitHS: number;
  /** The notch-adjusted HeatScore lost on a miss (unsigned). */
  missHS: number;
  /** Signed HeatScore: positive if hit, negative if miss, 0 if DNP/push. */
  signedHS: number;
  /** Whether odds were estimated (defaulted to 50/50) or actual. */
  oddsSource: "actual" | "estimated";
}

export interface SimulationResult {
  cardId: string;
  cardSize: number;
  score: number;
  totalPicks: number;
  picks: SimulatedPick[];
  netRaw: number;
  cardMultiplier: number;
  finalHeatScore: number;
}

// ---------------------------------------------------------------------------
// Query row types
// ---------------------------------------------------------------------------

type SimCardRow = {
  id: string;
  status: string;
  score: number;
  total_picks: number;
  card_size: number;
};

type SimPickRow = {
  id: string;
  selection: PickSelection;
  result: PickResult;
  actual_value: number | null;
  prop: {
    player_name: string;
    stat_category: StatCategory;
    line: number;
    over_odds: number | null;
    under_odds: number | null;
  };
};

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

/**
 * Simulate the HeatScore for an existing resolved card.
 *
 * All picks are treated as notch=0 (standard line) since the notch column
 * doesn't exist on existing picks yet. This shows what the HeatScore
 * *would have been* for the card as-is.
 */
export async function simulateCardHeatScore(
  cardId: string,
): Promise<SimulationResult> {
  const supabase = createAdminClient();

  const { data: cardData, error: cardError } = await (
    supabase.from("cards") as any
  )
    .select("id, status, score, total_picks, card_size")
    .eq("id", cardId)
    .single();

  if (cardError || !cardData) {
    throw new Error("Card not found");
  }

  const card = cardData as SimCardRow;

  if (card.status !== "resolved") {
    throw new Error("Card is not resolved");
  }

  const { data: picksData, error: picksError } = await (
    supabase.from("picks") as any
  )
    .select(
      "id, selection, result, actual_value, prop:props!inner(player_name, stat_category, line, over_odds, under_odds)",
    )
    .eq("card_id", cardId);

  if (picksError) {
    throw new Error(`Failed to fetch picks: ${picksError.message}`);
  }

  const picks = (picksData as SimPickRow[] | null) ?? [];

  // Standard notch for all existing picks
  const notchMultiplier = 1.0;

  const simulatedPicks: SimulatedPick[] = picks.map((pick) => {
    const odds =
      pick.selection === "over"
        ? pick.prop.over_odds
        : pick.prop.under_odds;
    const hasOdds = odds !== null;
    const impliedProb = hasOdds
      ? impliedProbFromAmericanOdds(odds)
      : 0.5;

    const base = baseHeatScore(impliedProb);
    const hitHS = pickHeatScoreOnHit(impliedProb, notchMultiplier);
    const missHS = pickHeatScoreOnMiss(notchMultiplier);

    let signedHS = 0;
    if (pick.result === "hit") {
      signedHS = hitHS;
    } else if (pick.result === "miss") {
      signedHS = -missHS;
    }

    return {
      pickId: pick.id,
      playerName: pick.prop.player_name,
      statCategory: pick.prop.stat_category,
      originalLine: pick.prop.line,
      selection: pick.selection,
      result: pick.result,
      actualValue: pick.actual_value,
      overOdds: pick.prop.over_odds,
      underOdds: pick.prop.under_odds,
      impliedProb,
      baseHS: base,
      hitHS,
      missHS,
      signedHS,
      oddsSource: hasOdds ? "actual" : "estimated",
    };
  });

  const cardResult = computeCardHeatScore(
    simulatedPicks.map((p) => ({
      heatScore: p.signedHS,
      result: p.result,
    })),
    card.card_size,
  );

  return {
    cardId: card.id,
    cardSize: card.card_size,
    score: card.score,
    totalPicks: card.total_picks,
    picks: simulatedPicks,
    netRaw: cardResult.netRaw,
    cardMultiplier: cardResult.multiplier,
    finalHeatScore: cardResult.final,
  };
}
