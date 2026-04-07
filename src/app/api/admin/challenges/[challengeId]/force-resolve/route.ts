import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, notFound, conflict, handleApiError } from "@/lib/api/errors";
import { UUID_RE } from "@/lib/api/validation";
import { logInfo, logError } from "@/lib/logger";

/**
 * POST /api/admin/challenges/:challengeId/force-resolve
 *
 * Manually resolve a stuck or cancelled group challenge using whatever
 * cards are available. Codifies the recovery procedure used for the
 * 2026-04-06 incident (challenge `e717c508-...`):
 *
 * 1. Find orphaned cards: cards where user_id matches a participant in
 *    this challenge but challenge_id is null (detached by an earlier
 *    over-aggressive cancel). Re-link them.
 * 2. Re-activate any participant whose linked card is locked or resolved
 *    but whose participant status was set to declined (collateral damage
 *    from the cancel cascade).
 * 3. Decline anyone with no card_id (true no-shows).
 * 4. Compute the winner from the active participants' resolved cards
 *    (highest score wins; tie = no winner).
 * 5. Set the challenge to status='resolved', winner_id, resolved_at=NOW().
 *
 * Refuses to run if:
 * - The challenge is not group lobby type
 * - The challenge is already resolved
 * - There are no cards at all to resolve from
 * - No card has reached `resolved` status yet (not all games are done)
 */
export async function POST(
  _request: Request,
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

    const supabase = createAdminClient();

    // Fetch challenge
    const { data: challengeData, error: chError } = await (
      supabase.from("challenges") as any
    )
      .select("id, lobby_type, status, challenger_id, winner_id")
      .eq("id", challengeId)
      .single();

    if (chError || !challengeData) {
      return notFound("Challenge");
    }

    const challenge = challengeData as {
      id: string;
      lobby_type: string | null;
      status: string;
      challenger_id: string;
      winner_id: string | null;
    };

    if (challenge.lobby_type !== "group") {
      return badRequest("Force resolve only applies to group challenges");
    }

    if (challenge.status === "resolved") {
      return conflict("Challenge is already resolved");
    }

    // Fetch all participants
    const { data: participantData } = await (
      supabase.from("challenge_participants") as any
    )
      .select("id, user_id, email, status, card_id")
      .eq("challenge_id", challengeId);

    const participants = ((participantData ?? []) as Array<{
      id: string;
      user_id: string | null;
      email: string | null;
      status: string;
      card_id: string | null;
    }>);

    if (participants.length === 0) {
      return badRequest("Challenge has no participants");
    }

    // Step 1: find orphaned cards (challenge_id IS NULL but user_id matches
    // a participant). Re-link them. Skip guest participants (no user_id).
    const participantUserIds = participants
      .map((p) => p.user_id)
      .filter((id): id is string => id !== null);

    let orphansRelinkedIds: string[] = [];
    if (participantUserIds.length > 0) {
      const { data: orphanCards } = await (supabase.from("cards") as any)
        .select("id, user_id")
        .is("challenge_id", null)
        .in("user_id", participantUserIds)
        .in("status", ["locked", "resolved"]);

      const orphans = ((orphanCards ?? []) as Array<{ id: string; user_id: string }>);
      // Only consider orphans whose owning participant currently has no
      // linked card (avoid stomping a different valid card linkage).
      const userIdsNeedingCard = new Set(
        participants.filter((p) => !p.card_id && p.user_id).map((p) => p.user_id as string),
      );
      const orphansToRelink = orphans.filter((c) => userIdsNeedingCard.has(c.user_id));

      if (orphansToRelink.length > 0) {
        const { error: relinkError } = await (supabase.from("cards") as any)
          .update({ challenge_id: challengeId })
          .in("id", orphansToRelink.map((c) => c.id));

        if (relinkError) {
          logError(
            "admin-force-resolve",
            "Failed to re-link orphaned cards",
            `/api/admin/challenges/${challengeId}/force-resolve`,
            relinkError,
          );
          return handleApiError(relinkError, "Failed to re-link orphaned cards");
        }

        orphansRelinkedIds = orphansToRelink.map((c) => c.id);

        // Update the participant rows in our local snapshot to reflect the
        // newly-linked card_ids — we use this for the next step's logic.
        for (const p of participants) {
          if (!p.card_id && p.user_id) {
            const orphan = orphansToRelink.find((c) => c.user_id === p.user_id);
            if (orphan) p.card_id = orphan.id;
          }
        }
      }
    }

    // Refetch all cards now linked to this challenge so we have status/score.
    const { data: cardsData } = await (supabase.from("cards") as any)
      .select("id, user_id, status, score, total_picks")
      .eq("challenge_id", challengeId);

    const cards = ((cardsData ?? []) as Array<{
      id: string;
      user_id: string | null;
      status: string;
      score: number;
      total_picks: number;
    }>);

    if (cards.length === 0) {
      return badRequest("No cards exist for this challenge — nothing to resolve");
    }

    const resolvedCards = cards.filter((c) => c.status === "resolved");
    if (resolvedCards.length === 0) {
      return badRequest(
        "No cards have resolved yet — wait for the games to finish before force-resolving",
      );
    }

    // Step 2: re-activate participants whose linked card is locked/resolved.
    // Step 3: decline participants with no linked card.
    const cardById = new Map(cards.map((c) => [c.id, c]));
    const reactivatedIds: string[] = [];
    const declinedIds: string[] = [];

    for (const p of participants) {
      const linkedCard = p.card_id ? cardById.get(p.card_id) ?? null : null;
      const cardIsPlayable =
        linkedCard && (linkedCard.status === "locked" || linkedCard.status === "resolved");

      if (cardIsPlayable && p.status !== "active") {
        const { error: reactivateError } = await (
          supabase.from("challenge_participants") as any
        )
          .update({ status: "active" })
          .eq("id", p.id);

        if (reactivateError) {
          logError(
            "admin-force-resolve",
            "Failed to re-activate participant",
            `/api/admin/challenges/${challengeId}/force-resolve`,
            reactivateError,
          );
          continue;
        }
        reactivatedIds.push(p.id);
      } else if (!cardIsPlayable && p.status !== "declined") {
        const { error: declineError } = await (
          supabase.from("challenge_participants") as any
        )
          .update({ status: "declined" })
          .eq("id", p.id);

        if (declineError) {
          logError(
            "admin-force-resolve",
            "Failed to decline participant",
            `/api/admin/challenges/${challengeId}/force-resolve`,
            declineError,
          );
          continue;
        }
        declinedIds.push(p.id);
      }
    }

    // Step 4: compute winner — highest score wins, tie = no winner.
    // Only consider resolved cards belonging to participants in this challenge.
    const eligibleCards = resolvedCards.filter((c) => c.user_id !== null);
    eligibleCards.sort((a, b) => b.score - a.score);

    let winnerId: string | null = null;
    if (eligibleCards.length > 0) {
      const top = eligibleCards[0];
      const isTie = eligibleCards.length > 1 && eligibleCards[1].score === top.score;
      if (!isTie) winnerId = top.user_id;
    }

    // Step 5: set challenge to resolved.
    const { error: updateError } = await (supabase.from("challenges") as any)
      .update({
        status: "resolved",
        winner_id: winnerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", challengeId);

    if (updateError) {
      return handleApiError(updateError, "Failed to set challenge to resolved");
    }

    logInfo(
      "admin-force-resolve",
      `Force-resolved challenge ${challengeId}: ${orphansRelinkedIds.length} orphan(s) re-linked, ${reactivatedIds.length} re-activated, ${declinedIds.length} declined, winner: ${winnerId ?? "tie"}`,
    );

    return NextResponse.json({
      success: true,
      challengeId,
      orphansRelinked: orphansRelinkedIds.length,
      participantsReactivated: reactivatedIds.length,
      participantsDeclined: declinedIds.length,
      winnerId,
    });
  } catch (error) {
    return handleApiError(error, "Failed to force-resolve challenge");
  }
}
