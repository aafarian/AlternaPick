import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { DAILY_CLAIM } from "@/lib/heatscore/constants";

/**
 * POST /api/fire-tokens/claim
 *
 * Claim the daily Flame Token bonus. Can be claimed once per UTC day.
 * Requires authentication. Returns the new balance.
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

    // Fetch current entry — fire_tokens_last_claim may not exist (pre-migration 059)
    const { data: entry } = await (admin.from("leaderboard_entries") as any)
      .select("fire_tokens_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    // Check last claim date separately (column may not exist)
    let lastClaim: string | null = null;
    try {
      const { data: claimData } = await (admin.from("leaderboard_entries") as any)
        .select("fire_tokens_last_claim")
        .eq("user_id", user.id)
        .maybeSingle();
      lastClaim = (claimData as { fire_tokens_last_claim: string | null } | null)?.fire_tokens_last_claim ?? null;
    } catch {
      // Column doesn't exist — treat as never claimed
    }

    if (lastClaim === today) {
      return badRequest("Already claimed today");
    }

    const currentBalance = (entry as { fire_tokens_balance: number } | null)?.fire_tokens_balance ?? 1000;
    const newBalance = currentBalance + DAILY_CLAIM;

    // Build update — only include last_claim if column exists
    const updateFields: Record<string, unknown> = { fire_tokens_balance: newBalance };
    try {
      // Test if column exists by trying a harmless query
      await (admin.from("leaderboard_entries") as any)
        .select("fire_tokens_last_claim")
        .limit(0);
      updateFields.fire_tokens_last_claim = today;
    } catch {
      // Column doesn't exist — skip setting it
    }

    if (entry) {
      const { error } = await (admin.from("leaderboard_entries") as any)
        .update(updateFields)
        .eq("user_id", user.id);

      if (error) return handleApiError(error, "fire-tokens/claim");
    } else {
      const { error } = await (admin.from("leaderboard_entries") as any)
        .insert({
          user_id: user.id,
          fire_tokens_balance: 1000 + DAILY_CLAIM,
          fire_tokens_lifetime: 0,
          fire_tokens_last_claim: today,
        });

      if (error) return handleApiError(error, "fire-tokens/claim");
    }

    return NextResponse.json({
      claimed: DAILY_CLAIM,
      balance: entry ? newBalance : 1000 + DAILY_CLAIM,
      next_claim: "tomorrow",
    });
  } catch (error) {
    return handleApiError(error, "fire-tokens/claim");
  }
}
