import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { typedFrom } from "@/lib/supabase/typed-queries";

const VALID_TYPES = new Set(["analytics", "wrapped"]);

const COLUMN_MAP: Record<string, string> = {
  analytics: "analytics_last_seen_at",
  wrapped: "wrapped_last_seen_at",
};

/**
 * PATCH /api/notifications/seen
 * Body: { type: "analytics" | "wrapped" }
 *
 * Updates the user's last-seen timestamp for the given page,
 * clearing the unseen-data indicator dot in the nav.
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

    const body = await request.json();
    const { type } = body as { type?: string };

    if (!type || !VALID_TYPES.has(type)) {
      return badRequest('type must be "analytics" or "wrapped"');
    }

    const column = COLUMN_MAP[type];
    const { error } = await typedFrom(supabase, "profiles")
      .update({ [column]: new Date().toISOString() } as any)
      .eq("id", user.id);

    if (error) {
      throw new Error(`Failed to update ${column}: ${error.message}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error, "Failed to mark as seen");
  }
}
