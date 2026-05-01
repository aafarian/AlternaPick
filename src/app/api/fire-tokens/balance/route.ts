import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, handleApiError } from "@/lib/api/errors";

/**
 * GET /api/fire-tokens/balance
 *
 * Returns the authenticated user's Fire Token balance and lifetime earnings.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return unauthorized();

    const { data, error } = await (supabase.from("leaderboard_entries") as any)
      .select("fire_tokens_balance, fire_tokens_lifetime")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return handleApiError(error, "fire-tokens/balance");
    }

    // No leaderboard row yet = new user with default balance
    return NextResponse.json({
      balance: data?.fire_tokens_balance ?? 1000,
      lifetime: data?.fire_tokens_lifetime ?? 0,
    });
  } catch (error) {
    return handleApiError(error, "fire-tokens/balance");
  }
}
