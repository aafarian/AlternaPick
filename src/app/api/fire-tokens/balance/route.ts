import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, handleApiError } from "@/lib/api/errors";

/**
 * GET /api/fire-tokens/balance
 *
 * Returns the authenticated user's Flame Token balance, lifetime earnings,
 * and whether they can claim today's daily bonus.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return unauthorized();

    // Use admin client to bypass RLS — auth is already verified above
    const admin = createAdminClient();

    // Query balance fields — fire_tokens_last_claim may not exist yet
    // (migration 059), so query it separately to avoid breaking the main query
    const { data, error } = await (admin.from("leaderboard_entries") as any)
      .select("fire_tokens_balance, fire_tokens_lifetime")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "fire-tokens/balance");
    }

    // Try to get last claim date (column may not exist pre-migration)
    let canClaim = true;
    try {
      const { data: claimData } = await (admin.from("leaderboard_entries") as any)
        .select("fire_tokens_last_claim")
        .eq("user_id", user.id)
        .maybeSingle();

      if (claimData) {
        const today = new Date().toISOString().slice(0, 10);
        canClaim = (claimData as { fire_tokens_last_claim: string | null }).fire_tokens_last_claim !== today;
      }
    } catch {
      // Column doesn't exist yet — claim is available
    }

    return NextResponse.json({
      balance: data?.fire_tokens_balance ?? 1000,
      lifetime: data?.fire_tokens_lifetime ?? 0,
      can_claim: canClaim,
    });
  } catch (error) {
    return handleApiError(error, "fire-tokens/balance");
  }
}
