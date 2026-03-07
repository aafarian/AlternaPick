import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { unauthorized, badRequest, notFound, handleApiError } from "@/lib/api/errors";
import { logError } from "@/lib/logger";
import type { Friendship, NotificationPreferences } from "@/lib/supabase/types";
import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "@/lib/friends/queries";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/friends/[id]
 * Get a single friendship's details.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { data: friendship, error } = await (
      supabase.from("friendships") as any
    )
      .select("*")
      .eq("id", id)
      .single();

    if (error || !friendship) {
      return notFound("Friendship");
    }

    const row = friendship as Friendship;

    // Only participants can view
    if (row.requester_id !== user.id && row.addressee_id !== user.id) {
      return notFound("Friendship");
    }

    return NextResponse.json({ friendship: row });
  } catch (error) {
    return handleApiError(error, "Failed to fetch friendship");
  }
}

/**
 * PATCH /api/friends/[id]
 * Accept or decline a friend request.
 * Body: { action: "accept" | "decline" }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as { action?: string };

    if (body.action !== "accept" && body.action !== "decline") {
      return badRequest('action must be "accept" or "decline"');
    }

    if (body.action === "accept") {
      const updated = await acceptFriendRequest(supabase, id, user.id);

      // Fire-and-forget: notify requester that their request was accepted
      try {
        const adminClient = createAdminClient();
        const [{ data: accepterProfile }, { data: requesterProfile }] =
          await Promise.all([
            (adminClient.from("profiles") as any)
              .select("username")
              .eq("id", user.id)
              .single() as Promise<{
              data: { username: string } | null;
            }>,
            (adminClient.from("profiles") as any)
              .select("notification_preferences")
              .eq("id", updated.requester_id)
              .single() as Promise<{
              data: { notification_preferences: NotificationPreferences | null } | null;
            }>,
          ]);
        const accepterName =
          (accepterProfile as { username: string } | null)?.username ?? "Someone";
        const requesterPrefs = requesterProfile?.notification_preferences ?? null;
        await createNotification(adminClient, {
          user_id: updated.requester_id,
          type: "friend_accepted",
          title: "Friend Request Accepted",
          body: `${accepterName} accepted your friend request`,
          metadata: { friendship_id: updated.id },
        }, requesterPrefs);
      } catch (notifError) {
        logError("friends", "Failed to create friend_accepted notification", undefined, notifError);
      }

      return NextResponse.json({ friendship: updated });
    }

    // Decline: deletes the row
    await declineFriendRequest(supabase, id, user.id);
    return NextResponse.json({ message: "Friend request declined" });
  } catch (error) {
    return handleApiError(error, "Failed to update friendship");
  }
}

/**
 * DELETE /api/friends/[id]
 * Unfriend - either party can delete.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    await removeFriend(supabase, id, user.id);
    return NextResponse.json({ message: "Friend removed" });
  } catch (error) {
    return handleApiError(error, "Failed to remove friend");
  }
}
