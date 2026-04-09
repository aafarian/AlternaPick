import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hardDeleteAccount } from "@/lib/account/delete";
import { unauthorized, handleApiError } from "@/lib/api/errors";

/**
 * POST /api/account/delete
 *
 * Hard-deletes the authenticated user's account. Permanent and irreversible.
 *
 * The schema's CASCADE chain (after migration 050) handles all the cleanup:
 * - The user's profile, cards, friendships, leaderboard, notifications,
 *   challenge_participants, achievements: all cascade-deleted
 * - Challenges where the user was challenger or opponent: cascade-deleted
 * - Cards on those deleted challenges (belonging to the OTHER party):
 *   `challenge_id` set to NULL → become solo cards. The other player keeps
 *   their picks and their card resolves normally.
 * - challenges.winner_id and profiles.referred_by: SET NULL (preserve
 *   historical record without dangling references)
 *
 * Returns 401 unauthenticated, 500 on delete failure, 200 on success.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const admin = createAdminClient();
    const result = await hardDeleteAccount(admin, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to delete account" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to delete account");
  }
}
