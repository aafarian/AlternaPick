import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  badRequest,
  notFound,
  conflict,
  handleApiError,
} from "@/lib/api/errors";
import { logInfo } from "@/lib/logger";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PATCH /api/admin/challenges/:challengeId/claim-guest
 *
 * Claims a guest challenge participant for an existing user account.
 * Accepts { participantEmail: string, targetUsername: string }.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ challengeId: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { challengeId } = await params;

    if (!UUID_RE.test(challengeId)) {
      return badRequest("Invalid challenge ID format");
    }

    const body = (await request.json()) as {
      participantEmail?: string;
      targetUsername?: string;
    };

    const { participantEmail, targetUsername } = body;

    if (!participantEmail || typeof participantEmail !== "string") {
      return badRequest("participantEmail is required");
    }

    if (!targetUsername || typeof targetUsername !== "string") {
      return badRequest("targetUsername is required");
    }

    const supabase = createAdminClient();
    const normalizedEmail = participantEmail.toLowerCase().trim();

    // 1. Look up target user by username
    const { data: targetUser, error: profileError } = await (
      supabase.from("profiles") as any
    )
      .select("id, username, display_name")
      .eq("username", targetUsername)
      .single();

    if (profileError || !targetUser) {
      return notFound("User");
    }

    const targetUserId = (targetUser as { id: string }).id;

    // 2. Verify the challenge exists
    const { data: challenge, error: challengeError } = await (
      supabase.from("challenges") as any
    )
      .select("id, challenger_id, opponent_id")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challenge) {
      return notFound("Challenge");
    }

    const challengeRow = challenge as {
      id: string;
      challenger_id: string;
      opponent_id: string | null;
    };

    // 3. Prevent self-challenge
    if (challengeRow.challenger_id === targetUserId) {
      return conflict("Target user is the challenger — cannot claim for self");
    }

    // 4. Check target user isn't already a participant
    const { data: existingParticipant } = await (
      supabase.from("challenge_participants") as any
    )
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("user_id", targetUserId)
      .limit(1);

    if (
      (existingParticipant as Array<{ id: string }> | null)?.length
    ) {
      return conflict("Target user is already a participant in this challenge");
    }

    // Also check if target user is already the opponent on the challenge row
    if (challengeRow.opponent_id === targetUserId) {
      return conflict("Target user is already the opponent in this challenge");
    }

    // 5. Find the guest participant row
    const { data: guestRows, error: guestError } = await (
      supabase.from("challenge_participants") as any
    )
      .select("id, user_id, email, card_id")
      .eq("challenge_id", challengeId)
      .ilike("email", normalizedEmail)
      .is("user_id", null)
      .limit(1);

    if (guestError) {
      return handleApiError(guestError, "Failed to find guest participant");
    }

    const guestParticipants = (guestRows as Array<{
      id: string;
      user_id: string | null;
      email: string | null;
      card_id: string | null;
    }> | null) ?? [];

    if (guestParticipants.length === 0) {
      return notFound("Guest participant");
    }

    const guest = guestParticipants[0];

    // 6. Update challenge_participants.user_id
    const { error: updateParticipantError } = await (
      supabase.from("challenge_participants") as any
    )
      .update({ user_id: targetUserId })
      .eq("id", guest.id);

    if (updateParticipantError) {
      return handleApiError(
        updateParticipantError,
        "Failed to update participant",
      );
    }

    // 7. If participant has a card_id, update cards.user_id where user_id IS NULL
    if (guest.card_id) {
      const { error: cardError } = await (supabase.from("cards") as any)
        .update({ user_id: targetUserId })
        .eq("id", guest.card_id)
        .is("user_id", null);

      if (cardError) {
        return handleApiError(cardError, "Failed to update card ownership");
      }
    }

    // 8. For 1v1 challenges with NULL opponent_id: also update challenges.opponent_id
    if (!challengeRow.opponent_id) {
      const { error: challengeUpdateError } = await (
        supabase.from("challenges") as any
      )
        .update({ opponent_id: targetUserId })
        .eq("id", challengeId);

      if (challengeUpdateError) {
        return handleApiError(
          challengeUpdateError,
          "Failed to update challenge opponent",
        );
      }
    }

    // Log success without PII — use IDs only
    logInfo(
      "admin",
      `Claimed guest participant ${guest.id} for user ${targetUserId} in challenge ${challengeId}`,
    );

    return NextResponse.json({
      success: true,
      participantId: guest.id,
      userId: targetUserId,
      username: (targetUser as { username: string }).username,
    });
  } catch (error) {
    return handleApiError(error, "Failed to claim guest participant");
  }
}
