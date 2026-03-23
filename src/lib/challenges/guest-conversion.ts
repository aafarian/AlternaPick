/**
 * Guest-to-User Conversion
 *
 * When a new user signs up, converts any guest challenge invitations
 * matching their email address to reference the new user account.
 * Uses (admin.from() as any) to work around the known Supabase PostgREST
 * type inference issue with chained queries (same pattern as queries.ts).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { logError, logInfo, logWarn } from "@/lib/logger";
import type { GuestToken, Challenge } from "@/lib/supabase/types";

type GuestTokenRow = Pick<GuestToken, "token" | "challenge_id" | "email" | "used_at">;
type ChallengeRow = Pick<Challenge, "id" | "challenger_id" | "opponent_id" | "status">;

/**
 * Convert guest challenges to reference a newly signed-up user.
 *
 * For each guest_token matching the email:
 * 1. Skip cancelled challenges and already-converted challenges (idempotent)
 * 2. Set challenges.opponent_id to the new user's ID
 * 3. Link guest cards (user_id IS NULL) to the new user
 * 4. Notify the challenger that their opponent signed up
 *
 * Errors are logged but never thrown — conversion must not block signup.
 */
export async function convertGuestChallenges(
  userId: string,
  email: string,
): Promise<{ converted: number }> {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();
  let converted = 0;

  // Find ALL tokens for this email (used or unused)
  const { data: tokens, error: tokenError } = (await (admin.from("guest_tokens") as any)
    .select("token, challenge_id, email, used_at")
    .eq("email", normalizedEmail)) as {
    data: GuestTokenRow[] | null;
    error: unknown;
  };

  if (tokenError) {
    logError("guest-conversion", "Failed to fetch guest tokens", "convertGuestChallenges", tokenError);
    return { converted };
  }

  if (!tokens || tokens.length === 0) {
    return { converted };
  }

  // Deduplicate by challenge_id (multiple tokens could reference the same challenge)
  const challengeIds = [...new Set(tokens.map((t) => t.challenge_id))];

  // Fetch the challenges to check status and opponent_id
  const { data: challenges, error: challengeError } = (await (admin.from("challenges") as any)
    .select("id, challenger_id, opponent_id, status")
    .in("id", challengeIds)) as {
    data: ChallengeRow[] | null;
    error: unknown;
  };

  if (challengeError) {
    logError("guest-conversion", "Failed to fetch challenges for conversion", "convertGuestChallenges", challengeError);
    return { converted };
  }

  if (!challenges || challenges.length === 0) {
    return { converted };
  }

  // Fetch the new user's username once for all notifications
  const { data: profile } = (await (admin.from("profiles") as any)
    .select("username")
    .eq("id", userId)
    .single()) as { data: { username: string } | null; error: unknown };

  const displayName = profile?.username ?? "Your opponent";

  for (const challenge of challenges) {
    // Skip cancelled challenges
    if (challenge.status === "cancelled") {
      continue;
    }

    // Skip already-converted challenges (idempotent)
    if (challenge.opponent_id) {
      continue;
    }

    // Set opponent_id on the challenge
    const { error: updateError } = await (admin.from("challenges") as any)
      .update({ opponent_id: userId })
      .eq("id", challenge.id);

    if (updateError) {
      logError("guest-conversion", `Failed to update opponent_id for challenge ${challenge.id}`, "convertGuestChallenges", updateError);
      continue;
    }

    // Link guest cards (user_id IS NULL) for this challenge to the new user
    const { error: cardError } = await (admin.from("cards") as any)
      .update({ user_id: userId })
      .eq("challenge_id", challenge.id)
      .is("user_id", null);

    if (cardError) {
      logWarn("guest-conversion", `Failed to link guest cards for challenge ${challenge.id}`, cardError);
    }

    converted++;

    // Notify the challenger that their opponent signed up
    try {
      await createNotification(admin, {
        user_id: challenge.challenger_id,
        type: "challenge_accepted",
        title: "Opponent Signed Up",
        body: `${displayName} signed up and accepted your challenge!`,
        metadata: { challenge_id: challenge.id },
      });
    } catch (notifError) {
      logError("guest-conversion", "Failed to notify challenger about conversion", "convertGuestChallenges", notifError);
    }
  }

  if (converted > 0) {
    logInfo("guest-conversion", `Converted ${converted} guest challenge(s) for user ${userId}`);
  }

  return { converted };
}
