import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { badRequest, handleApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logWarn } from "@/lib/logger";
import { STARTING_BALANCE } from "@/lib/heatscore/constants";

/**
 * POST /api/admin/fire-tokens
 *
 * Adjust a user's Flame Token balance. Admin only.
 * Body: { user_id: string, amount: number, reason?: string }
 *
 * Positive amount = give tokens, negative = take tokens.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const body = await request.json();
    const { user_id, amount, reason } = body as {
      user_id?: string;
      amount?: number;
      reason?: string;
    };

    if (!user_id || typeof user_id !== "string") {
      return badRequest("user_id is required");
    }
    if (amount == null || !Number.isInteger(amount) || amount === 0) {
      return badRequest("amount must be a non-zero integer");
    }

    const supabase = createAdminClient();

    // Fetch current balance
    const { data: entry, error: fetchError } = await (supabase.from("leaderboard_entries") as any)
      .select("fire_tokens_balance")
      .eq("user_id", user_id)
      .maybeSingle();

    if (fetchError) {
      return handleApiError(fetchError, "admin/fire-tokens");
    }

    const currentBalance = (entry as { fire_tokens_balance: number } | null)?.fire_tokens_balance ?? STARTING_BALANCE;
    const newBalance = Math.max(0, currentBalance + amount);

    if (entry) {
      // Intentionally does NOT update fire_tokens_lifetime — admin adjustments
      // are manual corrections, not earned tokens. Lifetime tracks organic earnings
      // (wager payouts, challenge bonuses, daily claims) for leaderboard ranking.
      const { error: updateError } = await (supabase.from("leaderboard_entries") as any)
        .update({ fire_tokens_balance: newBalance })
        .eq("user_id", user_id);

      if (updateError) {
        return handleApiError(updateError, "admin/fire-tokens");
      }
    } else {
      // Create entry if it doesn't exist
      const { error: insertError } = await (supabase.from("leaderboard_entries") as any)
        .insert({
          user_id,
          fire_tokens_balance: newBalance,
          fire_tokens_lifetime: 0,
        });

      if (insertError) {
        return handleApiError(insertError, "admin/fire-tokens");
      }
    }

    logWarn("admin", `Fire token adjustment: user=${user_id} amount=${amount > 0 ? "+" : ""}${amount} reason=${reason ?? "none"} balance=${currentBalance}→${newBalance}`);

    return NextResponse.json({
      previous_balance: currentBalance,
      new_balance: newBalance,
      amount,
    });
  } catch (error) {
    return handleApiError(error, "admin/fire-tokens");
  }
}

/**
 * GET /api/admin/fire-tokens?user_id=<id>
 *
 * Get a user's current Flame Token balance. Admin only.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("user_id");

    if (!userId) {
      return badRequest("user_id is required");
    }

    const supabase = createAdminClient();
    const { data } = await (supabase.from("leaderboard_entries") as any)
      .select("fire_tokens_balance, fire_tokens_lifetime")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      balance: (data as { fire_tokens_balance: number } | null)?.fire_tokens_balance ?? STARTING_BALANCE,
      lifetime: (data as { fire_tokens_lifetime: number } | null)?.fire_tokens_lifetime ?? 0,
    });
  } catch (error) {
    return handleApiError(error, "admin/fire-tokens");
  }
}
