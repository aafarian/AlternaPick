import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { upsertReaction, deleteReaction } from "@/lib/reactions/queries";
import { createNotification } from "@/lib/notifications/queries";
import type { ReactionEmoji, ReactionTargetType } from "@/lib/supabase/types";

const VALID_EMOJIS: ReactionEmoji[] = [
  "fire",
  "skull",
  "crying",
  "clown",
  "goat",
];
const VALID_TARGET_TYPES: ReactionTargetType[] = ["challenge", "card"];

/**
 * POST /api/reactions
 * Upsert a reaction on a target (challenge or card).
 * Body: { target_type, target_id, emoji }
 * Auth required.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as {
      target_type?: string;
      target_id?: string;
      emoji?: string;
    };

    if (!body.target_type || !body.target_id || !body.emoji) {
      return badRequest("target_type, target_id, and emoji are required");
    }

    if (!VALID_TARGET_TYPES.includes(body.target_type as ReactionTargetType)) {
      return badRequest(
        `Invalid target_type: ${body.target_type}. Must be "challenge" or "card".`
      );
    }

    if (!VALID_EMOJIS.includes(body.emoji as ReactionEmoji)) {
      return badRequest(
        `Invalid emoji: ${body.emoji}. Must be one of: ${VALID_EMOJIS.join(", ")}.`
      );
    }

    const targetType = body.target_type as ReactionTargetType;
    const targetId = body.target_id;
    const emoji = body.emoji as ReactionEmoji;

    const reaction = await upsertReaction(
      supabase,
      user.id,
      targetType,
      targetId,
      emoji
    );

    // Fire-and-forget: notify the target owner about the reaction
    sendReactionNotification(user.id, targetType, targetId, emoji).catch(
      (err) => {
        console.error("Failed to send reaction notification:", err);
      }
    );

    return NextResponse.json({ reaction }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to upsert reaction");
  }
}

/**
 * DELETE /api/reactions
 * Remove the authenticated user's reaction from a target.
 * Body: { target_type, target_id }
 * Auth required.
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as {
      target_type?: string;
      target_id?: string;
    };

    if (!body.target_type || !body.target_id) {
      return badRequest("target_type and target_id are required");
    }

    if (!VALID_TARGET_TYPES.includes(body.target_type as ReactionTargetType)) {
      return badRequest(
        `Invalid target_type: ${body.target_type}. Must be "challenge" or "card".`
      );
    }

    await deleteReaction(
      supabase,
      user.id,
      body.target_type as ReactionTargetType,
      body.target_id
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleApiError(error, "Failed to delete reaction");
  }
}

// ---------------------------------------------------------------------------
// Notification helper
// ---------------------------------------------------------------------------

/**
 * Send a "reaction_received" notification to the owner of the target.
 * - For challenges: find the other participant and notify them.
 * - For cards: notify the card owner.
 * Skips notification if the reactor is the target owner (self-reaction).
 */
async function sendReactionNotification(
  reactorUserId: string,
  targetType: ReactionTargetType,
  targetId: string,
  emoji: ReactionEmoji
) {
  const admin = createAdminClient();

  // Look up the reactor's username for the notification body
  const { data: reactorProfile } = await (admin.from("profiles") as any)
    .select("username")
    .eq("id", reactorUserId)
    .single();
  const reactorName =
    (reactorProfile as { username: string } | null)?.username ?? "Someone";

  let ownerUserId: string | null = null;

  if (targetType === "challenge") {
    // Find the other participant in the challenge
    const { data: challenge } = await (admin.from("challenges") as any)
      .select("creator_id, opponent_id")
      .eq("id", targetId)
      .single();

    if (challenge) {
      const c = challenge as { creator_id: string; opponent_id: string };
      // Notify the other participant (not the reactor)
      ownerUserId =
        c.creator_id === reactorUserId ? c.opponent_id : c.creator_id;
    }
  } else {
    // targetType === "card"
    const { data: card } = await (admin.from("cards") as any)
      .select("user_id")
      .eq("id", targetId)
      .single();

    if (card) {
      ownerUserId = (card as { user_id: string | null }).user_id;
    }
  }

  // Don't notify yourself
  if (!ownerUserId || ownerUserId === reactorUserId) {
    return;
  }

  await createNotification(admin, {
    user_id: ownerUserId,
    type: "reaction_received",
    title: "New Reaction",
    body: `${reactorName} reacted with ${emoji} on your ${targetType}!`,
    metadata: {
      target_type: targetType,
      target_id: targetId,
      emoji,
      reactor_id: reactorUserId,
    },
  });
}
