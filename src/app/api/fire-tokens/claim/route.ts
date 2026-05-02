import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { DAILY_CLAIM, STARTING_BALANCE } from "@/lib/heatscore/constants";

/**
 * POST /api/fire-tokens/claim
 *
 * Claim the daily Flame Token bonus. Can be claimed once per UTC day.
 * Uses `.neq("fire_tokens_last_claim", today)` in the UPDATE to prevent
 * double-spend from concurrent requests — if two requests race, only the
 * first one matches the WHERE clause and mutates the row.
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

    // Fetch current state
    const { data: entry } = await (admin.from("leaderboard_entries") as any)
      .select("fire_tokens_balance, fire_tokens_last_claim")
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

    // Early rejection for obvious duplicate (avoids unnecessary UPDATE)
    if (entry.fire_tokens_last_claim === today) {
      return badRequest("Already claimed today");
    }

    // Step 1: Set last_claim to today with .neq guard (idempotency — only one request wins)
    const { data: claimResult, error: claimError } = await (admin.from("leaderboard_entries") as any)
      .update({ fire_tokens_last_claim: today })
      .eq("user_id", user.id)
      .neq("fire_tokens_last_claim", today)
      .select("id");

    if (claimError) return handleApiError(claimError, "fire-tokens/claim");

    if (!claimResult || claimResult.length === 0) {
      return badRequest("Already claimed today");
    }

    // Step 2: Atomic credit via RPC — prevents lost writes from concurrent payouts
    const { data: newBalance, error: creditError } = await (admin.rpc as any)(
      "credit_fire_tokens",
      { p_user_id: user.id, p_amount: DAILY_CLAIM, p_include_lifetime: false },
    );

    if (creditError) return handleApiError(creditError, "fire-tokens/claim");

    return NextResponse.json({
      claimed: DAILY_CLAIM,
      balance: newBalance ?? (entry.fire_tokens_balance ?? STARTING_BALANCE) + DAILY_CLAIM,
      next_claim: "tomorrow",
    });
  } catch (error) {
    return handleApiError(error, "fire-tokens/claim");
  }
}
