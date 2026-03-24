/**
 * Guest-to-User Conversion
 *
 * When a new user signs up, converts any guest challenge invitations
 * matching their email address to reference the new user account.
 * Handles both 1v1 challenges (via challenges.opponent_id) and group
 * challenges (via challenge_participants.user_id).
 * Uses (admin.from() as any) to work around the known Supabase PostgREST
 * type inference issue with chained queries (same pattern as queries.ts).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { logError, logInfo, logWarn } from "@/lib/logger";
import type { GuestToken, Challenge } from "@/lib/supabase/types";

type GuestTokenRow = Pick<GuestToken, "challenge_id" | "email">;
type ChallengeRow = Pick<Challenge, "id" | "challenger_id" | "opponent_id" | "status" | "lobby_type">;

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
    .select("challenge_id, email")
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
    .select("id, challenger_id, opponent_id, status, lobby_type")
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

    // Prevent self-challenge: challenger signing up with the same email
    if (challenge.challenger_id === userId) {
      logWarn("guest-conversion", `Skipping self-challenge ${challenge.id} — challenger is the converting user`);
      continue;
    }

    if (challenge.lobby_type === "group") {
      // Group challenge: update challenge_participants.user_id for this email
      const didConvert = await convertGroupParticipant(admin, challenge.id, userId, normalizedEmail);
      if (!didConvert) continue;
    } else {
      // 1v1 challenge: update challenges.opponent_id
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
    }

    converted++;

    // For 1v1 challenges, conversion IS acceptance (we set opponent_id above).
    // For group challenges, conversion only links user_id to the participant row —
    // the user still needs to explicitly accept, which sends its own notification.
    if (challenge.lobby_type !== "group") {
      try {
        await createNotification(admin, {
          user_id: challenge.challenger_id,
          type: "challenge_accepted",
          title: "Challenge Accepted",
          body: `${displayName} accepted your challenge!`,
          metadata: { challenge_id: challenge.id },
        });
      } catch (notifError) {
        logError("guest-conversion", "Failed to notify challenger about conversion", "convertGuestChallenges", notifError);
      }
    }
  }

  // Also convert any challenge_participants rows that match by email
  // (covers group challenges where the guest token references a challenge
  // that isn't in the tokens list, e.g., if the token was deleted)
  await convertParticipantRowsByEmail(admin, userId, normalizedEmail);

  if (converted > 0) {
    logInfo("guest-conversion", `Converted ${converted} guest challenge(s) for user ${userId}`);
  }

  return { converted };
}

/**
 * Convert a group challenge participant row: set user_id and link guest cards.
 * Returns true if the conversion was performed, false if skipped (already converted or not found).
 */
async function convertGroupParticipant(
  admin: ReturnType<typeof createAdminClient>,
  challengeId: string,
  userId: string,
  normalizedEmail: string,
): Promise<boolean> {
  // Find the participant row by email
  const { data: participantRows, error: findError } = (await (admin.from("challenge_participants") as any)
    .select("id, user_id, card_id")
    .eq("challenge_id", challengeId)
    .eq("email", normalizedEmail)
    .limit(1)) as {
    data: Array<{ id: string; user_id: string | null; card_id: string | null }> | null;
    error: unknown;
  };

  if (findError) {
    logError("guest-conversion", `Failed to find participant for group challenge ${challengeId}`, "convertGroupParticipant", findError);
    return false;
  }

  const participant = (participantRows ?? [])[0];
  if (!participant) {
    return false;
  }

  // Skip if already converted (idempotent)
  if (participant.user_id) {
    return false;
  }

  // Set user_id on the participant row
  const { error: updateError } = await (admin.from("challenge_participants") as any)
    .update({ user_id: userId })
    .eq("id", participant.id);

  if (updateError) {
    logError("guest-conversion", `Failed to update participant user_id for challenge ${challengeId}`, "convertGroupParticipant", updateError);
    return false;
  }

  // Link guest cards (user_id IS NULL) linked to this participant's card_id
  if (participant.card_id) {
    const { error: cardError } = await (admin.from("cards") as any)
      .update({ user_id: userId })
      .eq("id", participant.card_id)
      .is("user_id", null);

    if (cardError) {
      logWarn("guest-conversion", `Failed to link guest card for group challenge ${challengeId}`, cardError);
    }
  }

  return true;
}

/**
 * Catch-all: find any challenge_participants rows matching the email that
 * haven't been converted yet (user_id IS NULL) and set the user_id.
 * This covers edge cases where a group challenge's guest token was not
 * found in the token lookup (e.g., token deleted or email-only invite).
 */
async function convertParticipantRowsByEmail(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  normalizedEmail: string,
): Promise<void> {
  const { data: rows, error } = (await (admin.from("challenge_participants") as any)
    .select("id, card_id")
    .eq("email", normalizedEmail)
    .is("user_id", null)
    .limit(50)) as {
    data: Array<{ id: string; card_id: string | null }> | null;
    error: unknown;
  };

  if (error) {
    logError("guest-conversion", "Failed to fetch participant rows by email", "convertParticipantRowsByEmail", error);
    return;
  }

  if (!rows || rows.length === 0) {
    return;
  }

  for (const row of rows) {
    const { error: updateError } = await (admin.from("challenge_participants") as any)
      .update({ user_id: userId })
      .eq("id", row.id)
      .is("user_id", null);

    if (updateError) {
      logError("guest-conversion", `Failed to convert participant row ${row.id}`, "convertParticipantRowsByEmail", updateError);
      continue;
    }

    // Link the card if present
    if (row.card_id) {
      const { error: cardError } = await (admin.from("cards") as any)
        .update({ user_id: userId })
        .eq("id", row.card_id)
        .is("user_id", null);

      if (cardError) {
        logWarn("guest-conversion", `Failed to link card for participant row ${row.id}`, cardError);
      }
    }
  }
}
