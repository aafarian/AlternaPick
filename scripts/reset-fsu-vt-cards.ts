/**
 * One-time script: Reset corrupted Florida St @ Virginia Tech cards.
 *
 * The game (8b2507e8-...) was auto-finalized without an ESPN ID due to the
 * "St" vs "State" normalizeTeam() bug. Resolution then marked all picks as
 * "miss" with null actual_value.
 *
 * This script:
 * 1. Sets the correct ESPN game ID + scores on the game
 * 2. Resets the 2 cards back to "locked" so resolution can re-run
 * 3. Clears pick results so they get re-resolved with real stats
 *
 * Usage: npx tsx scripts/reset-fsu-vt-cards.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const GAME_ID = "8b2507e8-7927-43eb-9b8a-abe49965ed46";
const ESPN_GAME_ID = "401820745";
const CARD_IDS = [
  "33ee6368-a715-42a5-a4e5-d20147ba2574",
  "1f62284c-067c-423f-9c88-55a179220472",
];

async function main() {
  console.log("=== Resetting corrupted Florida St @ Virginia Tech cards ===\n");

  // 1. Fix the game row with ESPN ID and correct scores
  console.log("1. Setting ESPN game ID and scores on game...");
  const { error: gameError } = await supabase
    .from("games")
    .update({
      external_event_id: ESPN_GAME_ID,
      home_score: 69,   // Virginia Tech
      away_score: 92,   // Florida State
    })
    .eq("id", GAME_ID);

  if (gameError) {
    console.error("   FAILED:", gameError.message);
    return;
  }
  console.log("   OK — game updated with external_event_id:", ESPN_GAME_ID);

  // 2. Reset cards back to locked
  console.log("2. Resetting cards to locked...");
  const { error: cardsError } = await supabase
    .from("cards")
    .update({
      status: "locked",
      score: 0,
      resolved_at: null,
    })
    .in("id", CARD_IDS);

  if (cardsError) {
    console.error("   FAILED:", cardsError.message);
    return;
  }
  console.log("   OK — 2 cards reset to locked");

  // 3. Clear pick results
  console.log("3. Clearing pick results...");
  const { error: picksError, count } = await supabase
    .from("picks")
    .update({
      result: null,
      actual_value: null,
    })
    .in("card_id", CARD_IDS);

  if (picksError) {
    console.error("   FAILED:", picksError.message);
    return;
  }
  console.log(`   OK — picks reset (count: ${count ?? "unknown"})`);

  console.log("\nDone! Next sync-status + resolution cycle will re-resolve with real boxscore data.");
}

main().catch(console.error);
