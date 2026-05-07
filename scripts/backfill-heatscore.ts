/**
 * One-off backfill script: recomputes heat_score and fire_token_payout for
 * all resolved cards that are missing these values.
 *
 * Context: Due to bugs in the initial HeatScore rollout, existing resolved
 * cards have NULL heat_score / fire_token_payout. This script recomputes
 * them using the same logic as card resolution.
 *
 * Idempotent: skips cards that already have heat_score set.
 *
 * Usage: npx tsx scripts/backfill-heatscore.ts
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logger";
import {
  computeQualityBonus,
  computeCardHeatScore,
  computeFireTokenPayout,
  computeWagerNotchScale,
  HEATSCORE_HIT_BASE,
  getNotchTier,
} from "@/lib/heatscore/compute";
import type { StatCategory } from "@/lib/supabase/types";

const BATCH_SIZE = 50;

interface BackfillPick {
  id: string;
  result: "hit" | "miss" | "push" | "dnp" | "pending";
  actual_value: number | null;
  notch: number | null;
  adjusted_line: number | null;
  selection: "over" | "under";
  props: {
    line: number;
    stat_category: StatCategory;
  };
}

interface BackfillCard {
  id: string;
  card_size: number;
  fire_token_wager: number | null;
  score: number;
  total_picks: number;
}

async function main() {
  const supabase = createAdminClient();

  logInfo("backfill-hs", "=== Backfilling HeatScore for resolved cards ===");

  let totalCards = 0;
  let totalUpdated = 0;
  let totalErrors = 0;
  const failedCardIds = new Set<string>();
  const MAX_BATCHES = 500;
  let batchCount = 0;

  // Process in batches until no more cards are returned.
  // Since we filter by heat_score IS NULL, successfully updated cards
  // drop out of subsequent queries — no offset increment needed.
  while (true) {
    if (++batchCount > MAX_BATCHES) {
      logError("backfill-hs", `Exceeded ${MAX_BATCHES} batches — aborting to prevent infinite loop`);
      break;
    }
    // Fetch resolved cards where heat_score is NULL (idempotent — skip already-computed)
    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("id, card_size, fire_token_wager, score, total_picks")
      .eq("status", "resolved")
      .is("heat_score", null)
      .order("resolved_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (cardsError) {
      logError("backfill-hs", "Failed to fetch cards", undefined, cardsError);
      process.exit(1);
    }

    if (!cards || cards.length === 0) {
      break;
    }

    totalCards += cards.length;
    logInfo("backfill-hs", `Processing batch of ${cards.length} cards (${totalCards} total so far)`);

    for (const card of cards as BackfillCard[]) {
      if (failedCardIds.has(card.id)) continue;
      try {
        // Fetch picks for this card
        const { data: picks, error: picksError } = await supabase
          .from("picks")
          .select("id, result, actual_value, notch, adjusted_line, selection, props(line, stat_category)")
          .eq("card_id", card.id);

        if (picksError || !picks) {
          logError("backfill-hs", `Failed to fetch picks for card ${card.id}`, undefined, picksError);
          failedCardIds.add(card.id);
          totalErrors++;
          continue;
        }

        const typedPicks = picks as unknown as BackfillPick[];

        // Compute quality bonus (shared by both scoring systems)
        const qualityResult = computeQualityBonus(
          typedPicks.map((p) => ({
            actualValue: p.actual_value,
            line: p.adjusted_line ?? p.props.line,
            selection: p.selection,
            result: p.result,
            notchMultiplier: getNotchTier(p.notch ?? 0).multiplier,
          })),
        );

        // Compute per-pick heat_score and update each pick
        const perPickScores: { pickId: string; heatScore: number }[] = [];
        let hits = 0;
        let misses = 0;

        for (let i = 0; i < typedPicks.length; i++) {
          const p = typedPicks[i];
          const notchMult = getNotchTier(p.notch ?? 0).multiplier;
          const qt = qualityResult.perPick[i];
          let pickHeatScore = 0;

          if (p.result === "hit") {
            pickHeatScore = Math.round(HEATSCORE_HIT_BASE * notchMult) + qt;
            hits++;
          } else if (p.result === "miss") {
            pickHeatScore = qt; // quality penalty only
            misses++;
          }
          // DNP/push: 0 contribution

          perPickScores.push({ pickId: p.id, heatScore: pickHeatScore });
        }

        // Update each pick's heat_score
        for (const { pickId, heatScore } of perPickScores) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generated types don't include heatscore columns
          const { error: pickUpdateError } = await (supabase.from("picks") as any)
            .update({ heat_score: heatScore })
            .eq("id", pickId);

          if (pickUpdateError) {
            logError("backfill-hs", `Failed to update pick ${pickId}`, undefined, pickUpdateError);
            totalErrors++;
          }
        }

        // Card-level heat_score: sum of per-pick scores.
        // Use 0 (not null) for all-DNP/push cards so they don't stay in the IS NULL filter.
        const scoredTotal = hits + misses;
        const cardHeatScore = scoredTotal > 0
          ? perPickScores.reduce((sum, p) => sum + p.heatScore, 0)
          : 0;

        // Fire token payout: only if card has a wager
        let payout: number | null = null;
        if (card.fire_token_wager != null) {
          const hsResult = computeCardHeatScore(hits, misses, card.card_size);
          if (hsResult.effectiveSize <= 1) {
            payout = card.fire_token_wager; // all voided or only 1 pick left — full refund
          } else {
            const scoreableNotches = typedPicks
              .filter((p) => p.result === "hit" || p.result === "miss")
              .map((p) => p.notch ?? 0);
            const notchScale = computeWagerNotchScale(scoreableNotches);
            payout = computeFireTokenPayout(
              card.fire_token_wager,
              hsResult.multiplier,
              notchScale,
            );
          }
        }

        // Update the card
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generated types don't include heatscore columns
        const { error: cardUpdateError } = await (supabase.from("cards") as any)
          .update({
            heat_score: cardHeatScore,
            fire_token_payout: payout,
          })
          .eq("id", card.id);

        if (cardUpdateError) {
          logError("backfill-hs", `Failed to update card ${card.id}`, undefined, cardUpdateError);
          failedCardIds.add(card.id);
          totalErrors++;
          continue;
        }

        totalUpdated++;
        logInfo(
          "backfill-hs",
          `Card ${card.id}: score=${card.score}/${card.total_picks}, heat_score=${cardHeatScore}, payout=${payout}`,
        );
      } catch (err) {
        logError("backfill-hs", `Error processing card ${card.id}`, undefined, err);
        failedCardIds.add(card.id);
        totalErrors++;
      }
    }

    // If we got fewer than BATCH_SIZE, we've processed all cards.
    // Note: we don't increment offset because we're filtering by heat_score IS NULL,
    // so successfully updated cards won't appear in the next batch.
    if (cards.length < BATCH_SIZE) {
      break;
    }
  }

  logInfo("backfill-hs", "=== Backfill Complete ===");
  logInfo("backfill-hs", `Total cards found: ${totalCards}`);
  logInfo("backfill-hs", `Successfully updated: ${totalUpdated}`);
  logInfo("backfill-hs", `Errors: ${totalErrors}`);
}

main().catch((err) => {
  logError("backfill-hs", "Fatal error in backfill script", undefined, err);
  process.exit(1);
});
