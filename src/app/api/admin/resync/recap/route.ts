import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { handleApiError, badRequest } from "@/lib/api/errors";
import {
  computeDailyRecap,
  computeWeeklyRecap,
  getMondayOfWeek,
  getSundayOfWeek,
} from "@/lib/recaps/compute";

/**
 * POST /api/admin/resync/recap
 *
 * Recomputes the daily and weekly recap for the given date.
 * computeDailyRecap already upserts, so no delete needed.
 * Body: { date: "YYYY-MM-DD" }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { date } = body as { date?: string };

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return badRequest("A valid date in YYYY-MM-DD format is required");
    }

    // Recompute daily recap (upserts internally)
    const result = await computeDailyRecap(date);

    // Also recompute the weekly recap covering this date
    const monday = getMondayOfWeek(date);
    const sunday = getSundayOfWeek(monday);
    const weeklyResult = await computeWeeklyRecap(sunday, monday);

    return NextResponse.json({
      date,
      totalCards: result.recapData.totalCards,
      totalPicks: result.recapData.totalPicks,
      platformHitRate: result.recapData.platformHitRate,
      personalHighlightCount: Object.keys(result.personalHighlights).length,
      weekly: {
        computed: true,
        daysIncluded: weeklyResult.dailyTrend.length,
        weeklyHitRate: weeklyResult.weeklyHitRate,
      },
    });
  } catch (err) {
    return handleApiError(err, "Failed to recompute recap");
  }
}
