import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import {
  getUnreadCounts,
  getNotifications,
  markAllRead,
} from "@/lib/notifications/queries";

/**
 * GET /api/notifications
 * Query params:
 *   - type: "counts" | "list" | "both" (default: "counts")
 *     - "counts": returns { pendingFriendRequests, pendingChallenges, unreadNotifications }
 *     - "list": returns { notifications: Notification[], pagination: { limit, offset } }
 *     - "both": returns counts + notifications
 *   - limit: number (default 20, max 100) — used when type is "list" or "both"
 *   - offset: number (default 0) — used when type is "list" or "both"
 *
 * Backward compatibility: calling with no params returns counts only (same as before).
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

    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? "counts";
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 1),
      100
    );
    const offset = Math.max(
      parseInt(searchParams.get("offset") ?? "0", 10) || 0,
      0
    );

    if (type !== "counts" && type !== "list" && type !== "both") {
      return badRequest('type must be "counts", "list", or "both"');
    }

    if (type === "counts") {
      const counts = await getUnreadCounts(supabase, user.id);
      return NextResponse.json(counts);
    }

    if (type === "list") {
      const notifications = await getNotifications(
        supabase,
        user.id,
        limit,
        offset
      );
      return NextResponse.json({
        notifications,
        pagination: { limit, offset },
      });
    }

    // type === "both"
    const [counts, notifications] = await Promise.all([
      getUnreadCounts(supabase, user.id),
      getNotifications(supabase, user.id, limit, offset),
    ]);

    return NextResponse.json({
      ...counts,
      notifications,
      pagination: { limit, offset },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch notifications");
  }
}

/**
 * PATCH /api/notifications
 * Body: { action: "mark_all_read" }
 * Marks all unread notifications as read for the authenticated user.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as { action?: string };

    if (body.action !== "mark_all_read") {
      return badRequest('action must be "mark_all_read"');
    }

    await markAllRead(supabase, user.id);
    return NextResponse.json({ message: "All notifications marked as read" });
  } catch (error) {
    return handleApiError(error, "Failed to mark notifications as read");
  }
}
