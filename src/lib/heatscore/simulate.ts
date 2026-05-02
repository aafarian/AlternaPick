import { createAdminClient } from "@/lib/supabase/admin";
import type { PickResult, PickSelection, StatCategory } from "@/lib/supabase/types";
import {
  computeCardHeatScore,
  computeFireTokenPayout,
  computeWagerNotchScale,
  computeQualityBonus,
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
  /** Flat token bonus/penalty based on how much the pick beat/missed the line. */
  qualityTokens: number;
}

export interface SimulationResult {
  cardId: string;
  cardSize: number;
  score: number;
  totalPicks: number;
  picks: SimulatedPick[];
  hits: number;
  effectiveSize: number;
  heatScoreMultiplier: number;
  /** Total quality bonus (flat tokens) from hit/miss margins. */
  qualityBonus: number;
  /** Simulated wager for demo purposes (50 tokens). */
  simulatedWager: number;
  /** Simulated payout: simulatedWager x heatScoreMultiplier + qualityBonus. */
  simulatedPayout: number;
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
  notch: number | null;
  prop: {
    player_name: string;
    stat_category: StatCategory;
    line: number;
  };
};

// ---------------------------------------------------------------------------
// Simulator
// ---------------------------------------------------------------------------

const DEMO_WAGER = 50;

/**
 * Simulate the HeatScore multiplier and Flame Token payout for an existing
 * resolved card. Uses a demo wager of 50 tokens to show what the payout
 * would have been.
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
      "id, selection, result, actual_value, notch, prop:props!inner(player_name, stat_category, line)",
    )
    .eq("card_id", cardId);

  if (picksError) {
    throw new Error(`Failed to fetch picks: ${picksError.message}`);
  }

  const picks = (picksData as SimPickRow[] | null) ?? [];

  // Compute quality bonus per pick
  const qualityResult = computeQualityBonus(
    picks.map((p) => ({
      actualValue: p.actual_value,
      line: p.prop.line,
      selection: p.selection,
      result: p.result,
    })),
  );

  const simulatedPicks: SimulatedPick[] = picks.map((pick, i) => ({
    pickId: pick.id,
    playerName: pick.prop.player_name,
    statCategory: pick.prop.stat_category,
    originalLine: pick.prop.line,
    selection: pick.selection,
    result: pick.result,
    actualValue: pick.actual_value,
    qualityTokens: qualityResult.perPick[i],
  }));

  const hitCount = picks.filter((p) => p.result === "hit").length;
  const missCount = picks.filter((p) => p.result === "miss").length;

  const cardResult = computeCardHeatScore(
    hitCount,
    missCount,
    card.card_size,
  );

  const notchScale = computeWagerNotchScale(picks.map((p) => p.notch ?? 0));

  const simulatedPayout = computeFireTokenPayout(
    DEMO_WAGER,
    cardResult.multiplier,
    qualityResult.total,
    notchScale,
  );

  return {
    cardId: card.id,
    cardSize: card.card_size,
    score: card.score,
    totalPicks: card.total_picks,
    picks: simulatedPicks,
    hits: cardResult.hits,
    effectiveSize: cardResult.effectiveSize,
    heatScoreMultiplier: cardResult.multiplier,
    qualityBonus: qualityResult.total,
    simulatedWager: DEMO_WAGER,
    simulatedPayout,
  };
}
