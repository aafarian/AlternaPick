import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import {
  getCategoryStats,
  getPlayerStats,
  getDirectionStats,
  getTrendData,
} from "@/lib/analytics/queries";

/**
 * GET /api/analytics
 * Returns the authenticated user's prop pick analytics:
 *   - categories: hit-rate by stat category
 *   - players: top 10 players by pick volume
 *   - directions: over vs under hit-rates
 *   - trend: daily hit-rate over the last 30 days
 *
 * Private, cached for 5 minutes client-side.
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

    const [categories, players, directions, trend] = await Promise.all([
      getCategoryStats(supabase, user.id),
      getPlayerStats(supabase, user.id, 10),
      getDirectionStats(supabase, user.id),
      getTrendData(supabase, user.id, 30),
    ]);

    return NextResponse.json(
      { categories, players, directions, trend },
      {
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      }
    );
  } catch (error) {
    return handleApiError(error, "Failed to fetch analytics");
  }
}
