import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import { markNotificationRead } from "@/lib/notifications/queries";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/notifications/[id]
 * Mark a single notification as read.
 * The notification must belong to the authenticated user.
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

    const notification = await markNotificationRead(supabase, user.id, id);

    if (!notification) {
      return notFound("Notification");
    }

    return NextResponse.json({ notification });
  } catch (error) {
    return handleApiError(error, "Failed to mark notification as read");
  }
}
