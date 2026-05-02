import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import { logWarn } from "@/lib/logger";

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
    const { data, error } = await (admin.from("leaderboard_entries") as any)
      .select("fire_tokens_balance, fire_tokens_lifetime, fire_tokens_last_claim")
      .eq("user_id", user.id)
      .maybeSingle();

    // TODO: remove debug logging
    logWarn("fire-tokens", `Balance query: user=${user.id} data=${JSON.stringify(data)} error=${error?.message ?? "none"}`);

    if (error) {
      return handleApiError(error, "fire-tokens/balance");
    }

    const today = new Date().toISOString().slice(0, 10);
    const lastClaim = (data as { fire_tokens_last_claim: string | null } | null)?.fire_tokens_last_claim;
    const canClaim = lastClaim !== today;

    return NextResponse.json({
      balance: data?.fire_tokens_balance ?? 1000,
      lifetime: data?.fire_tokens_lifetime ?? 0,
      can_claim: canClaim,
    });
  } catch (error) {
    return handleApiError(error, "fire-tokens/balance");
  }
}
