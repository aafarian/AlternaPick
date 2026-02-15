/**
 * One-off backfill script: recomputes leaderboard_entries stats from
 * resolved cards and their picks for all users.
 *
 * Prerequisites:
 *   - Migration 017 (total_attempted_picks column) must be applied first
 *
 * Usage: npx tsx scripts/backfill-leaderboard.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ResolvedCard {
  id: string;
  user_id: string;
  score: number;
  total_picks: number;
  resolved_at: string;
}

interface UserStats {
  total_cards: number;
  total_correct_picks: number;
  total_attempted_picks: number;
  win_rate: number;
  current_streak: number;
  best_streak: number;
}

async function main() {
  console.log("=== Backfilling Leaderboard Stats ===\n");

  // 1. Fetch all resolved cards with a user_id, ordered by resolved_at
  const { data: cards, error: cardsErr } = await supabase
    .from("cards")
    .select("id, user_id, score, total_picks, resolved_at")
    .eq("status", "resolved")
    .not("user_id", "is", null)
    .order("resolved_at", { ascending: true });

  if (cardsErr) {
    console.error("Failed to fetch resolved cards:", cardsErr.message);
    process.exit(1);
  }

  if (!cards || cards.length === 0) {
    console.log("No resolved cards found. Nothing to backfill.");
    return;
  }

  console.log(`Found ${cards.length} resolved cards\n`);

  // 2. Group by user_id and compute stats
  const userStats = new Map<string, UserStats>();

  for (const card of cards as ResolvedCard[]) {
    const stats = userStats.get(card.user_id) ?? {
      total_cards: 0,
      total_correct_picks: 0,
      total_attempted_picks: 0,
      win_rate: 0,
      current_streak: 0,
      best_streak: 0,
    };

    stats.total_cards += 1;
    stats.total_correct_picks += card.score;
    stats.total_attempted_picks += card.total_picks;

    // Win threshold: >= 66% correct picks
    const winThreshold = Math.ceil(card.total_picks * 0.66);
    const isWin = card.total_picks > 0 && card.score >= winThreshold;

    stats.current_streak = isWin ? stats.current_streak + 1 : 0;
    stats.best_streak = Math.max(stats.best_streak, stats.current_streak);

    stats.win_rate =
      stats.total_attempted_picks > 0
        ? Math.round(
            (stats.total_correct_picks / stats.total_attempted_picks) *
              100 *
              100
          ) / 100
        : 0;

    userStats.set(card.user_id, stats);
  }

  console.log(`Computed stats for ${userStats.size} users\n`);

  // 3. Upsert each user's leaderboard entry (preserve h2h fields)
  let updated = 0;
  let inserted = 0;
  let errors = 0;

  for (const [userId, stats] of userStats) {
    // Check if entry exists
    const { data: existing } = await supabase
      .from("leaderboard_entries")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("leaderboard_entries")
        .update({
          total_cards: stats.total_cards,
          total_correct_picks: stats.total_correct_picks,
          total_attempted_picks: stats.total_attempted_picks,
          win_rate: stats.win_rate,
          current_streak: stats.current_streak,
          best_streak: stats.best_streak,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) {
        console.error(`  ERROR updating ${userId}: ${error.message}`);
        errors++;
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("leaderboard_entries").insert({
        user_id: userId,
        total_cards: stats.total_cards,
        total_correct_picks: stats.total_correct_picks,
        total_attempted_picks: stats.total_attempted_picks,
        win_rate: stats.win_rate,
        current_streak: stats.current_streak,
        best_streak: stats.best_streak,
        h2h_wins: 0,
        h2h_losses: 0,
      });

      if (error) {
        console.error(`  ERROR inserting ${userId}: ${error.message}`);
        errors++;
      } else {
        inserted++;
      }
    }
  }

  console.log(`\n=== Results ===`);
  console.log(`Updated: ${updated}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);

  // 4. Print summary of all entries
  const { data: final } = await supabase
    .from("leaderboard_entries")
    .select("user_id, total_cards, total_correct_picks, total_attempted_picks, win_rate, current_streak, best_streak")
    .order("win_rate", { ascending: false });

  if (final && final.length > 0) {
    console.log(`\n=== Current Leaderboard (${final.length} entries) ===`);
    for (const row of final) {
      console.log(
        `  ${row.user_id}: ${row.total_correct_picks}/${row.total_attempted_picks} picks (${row.win_rate}%) | ${row.total_cards} cards | streak: ${row.current_streak} (best: ${row.best_streak})`
      );
    }
  }
}

main().catch(console.error);
