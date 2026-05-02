import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { DAILY_CLAIM, STARTING_BALANCE } from "@/lib/heatscore/constants";

/**
 * POST /api/fire-tokens/claim
 *
 * Claim the daily Flame Token bonus. Can be claimed once per UTC day.
 * Uses an atomic RPC (claim_daily_tokens) that sets last_claim and
 * increments balance in a single transaction — no partial failure
 * where the claim slot is consumed but tokens aren't credited.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return unauthorized();

    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

    // Check if user has a leaderboard entry
    const { data: entry } = await (admin.from("leaderboard_entries") as any)
      .select("fire_tokens_last_claim")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!entry) {
      // New user — create entry with first claim
      const { error: insertError } = await (admin.from("leaderboard_entries") as any)
        .insert({
          user_id: user.id,
          fire_tokens_balance: STARTING_BALANCE + DAILY_CLAIM,
          fire_tokens_lifetime: 0,
          fire_tokens_last_claim: today,
        });

      if (insertError) return handleApiError(insertError, "fire-tokens/claim");

      return NextResponse.json({
        claimed: DAILY_CLAIM,
        balance: STARTING_BALANCE + DAILY_CLAIM,
        next_claim: "tomorrow",
      });
    }

    // Early rejection for obvious duplicate
    if (entry.fire_tokens_last_claim === today) {
      return badRequest("Already claimed today");
    }

    // Atomic claim: sets last_claim and increments balance in one transaction.
    // Returns -1 if already claimed today (concurrent request won), or new balance.
    const { data: newBalance, error: claimError } = await (admin.rpc as any)(
      "claim_daily_tokens",
      { p_user_id: user.id, p_amount: DAILY_CLAIM, p_today: today },
    );

    if (claimError) return handleApiError(claimError, "fire-tokens/claim");

    if (newBalance === -1) {
      return badRequest("Already claimed today");
    }

    return NextResponse.json({
      claimed: DAILY_CLAIM,
      balance: newBalance,
      next_claim: "tomorrow",
    });
  } catch (error) {
    return handleApiError(error, "fire-tokens/claim");
  }
}
