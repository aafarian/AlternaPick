import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getFriendRequestEmailProps } from "@/lib/email/templates/friend-request";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import type { NotificationPreferences } from "@/lib/supabase/types";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
} from "@/lib/friends/queries";

/**
 * GET /api/friends
 * Returns the authenticated user's friends list and pending requests.
 * Query params: ?status=accepted|pending (default: accepted)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "accepted";

    if (status === "pending") {
      const requests = await getPendingRequests(supabase, user.id);
      return NextResponse.json({ friends: requests });
    }

    const friends = await getFriends(supabase, user.id);
    return NextResponse.json({ friends });
  } catch (error) {
    return handleApiError(error, "Failed to fetch friends");
  }
}

/**
 * POST /api/friends
 * Send a friend request.
 * Body: { addressee_username: string }
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

    const body = (await request.json()) as { addressee_username?: string };

    if (!body.addressee_username || typeof body.addressee_username !== "string") {
      return badRequest("addressee_username is required");
    }

    const friendship = await sendFriendRequest(
      supabase,
      user.id,
      body.addressee_username.trim()
    );

    // Fire-and-forget: notify addressee about the friend request
    try {
      const adminClient = createAdminClient();
      const [{ data: requesterProfile }, { data: addresseeProfile }] =
        await Promise.all([
          (adminClient.from("profiles") as any)
            .select("username")
            .eq("id", user.id)
            .single() as Promise<{
            data: { username: string } | null;
          }>,
          (adminClient.from("profiles") as any)
            .select("username, email, notification_preferences")
            .eq("id", friendship.addressee_id)
            .single() as Promise<{
            data: { username: string; email: string; notification_preferences: NotificationPreferences | null } | null;
          }>,
        ]);

      const requesterName = requesterProfile?.username ?? "Someone";
      const addresseeName = addresseeProfile?.username ?? "Friend";

      const addresseePrefs = addresseeProfile?.notification_preferences ?? null;

      await createNotification(adminClient, {
        user_id: friendship.addressee_id,
        type: "friend_request",
        title: "New Friend Request",
        body: `${requesterName} sent you a friend request`,
        metadata: { friendship_id: friendship.id },
      }, addresseePrefs);

      // Send email notification (fire-and-forget, never blocks)
      if (addresseeProfile?.email && shouldSendEmail("friend_request", addresseePrefs)) {
        const { subject, react } = getFriendRequestEmailProps({
          requesterUsername: requesterName,
          addresseeUsername: addresseeName,
        });
        sendEmail({ to: addresseeProfile.email, subject, react }).catch(
          () => {}
        );
      }
    } catch (notifError) {
      console.error("Failed to create friend_request notification:", notifError);
    }

    return NextResponse.json({ friendship }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to send friend request");
  }
}
