import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUnreadCounts } from "@/lib/notifications/queries";

/**
 * GET /api/notifications
 * Returns pending friend request and challenge counts for the authenticated user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const counts = await getUnreadCounts(supabase, user.id);

    return NextResponse.json(counts);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch notification counts", message },
      { status: 500 }
    );
  }
}
