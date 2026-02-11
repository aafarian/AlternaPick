import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import { getStreakInfo } from "@/lib/streaks/queries";

export interface StreakResponse {
  daily_streak: number;
  best_daily_streak: number;
  freezes_available: number;
  next_freeze_reset: string | null;
}

/**
 * GET /api/streaks
 * Returns streak data for the authenticated user.
 * Powers the streak badge in the header.
 * Returns sensible defaults (all zeros) for users without leaderboard entries.
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

    const streakInfo = await getStreakInfo(supabase, user.id);

    const response: StreakResponse = {
      daily_streak: streakInfo.daily_streak,
      best_daily_streak: streakInfo.best_daily_streak,
      freezes_available: streakInfo.freezes_available,
      next_freeze_reset: streakInfo.next_freeze_reset,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "Failed to fetch streak data");
  }
}
