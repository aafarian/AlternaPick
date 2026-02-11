import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import {
  getAllAchievements,
  getUserAchievements,
} from "@/lib/achievements/queries";

/**
 * GET /api/achievements
 * Returns the full achievement catalog and the authenticated user's unlocked badges.
 *
 * Response shape:
 *   { achievements: Achievement[], unlocked: UserAchievement[] }
 *
 * - achievements: every badge definition (id, key, name, description, icon, tier, category, threshold)
 * - unlocked: the user's earned badges with achievement_id and unlocked_at timestamps
 *
 * The frontend merges these two lists to render a badge grid with locked/unlocked states.
 *
 * Returns 401 for unauthenticated requests.
 * Cached privately for 5 minutes client-side.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const [achievements, unlocked] = await Promise.all([
      getAllAchievements(supabase),
      getUserAchievements(supabase, user.id),
    ]);

    return NextResponse.json(
      { achievements, unlocked },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, "Failed to fetch achievements");
  }
}
