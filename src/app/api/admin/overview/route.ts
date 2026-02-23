import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";

export interface AdminOverviewStats {
  totalUsers: number;
  signupsToday: number;
  signupsThisWeek: number;
  cardsLockedToday: number;
  activeChallenges: number;
  picksMadeToday: number;
  avgWinRate: number;
  totalCards: number;
  dailyActiveUsers: number;
}

/**
 * GET /api/admin/overview
 * Returns platform-wide stats for the admin dashboard.
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const supabase = createAdminClient();

    // Compute date boundaries in UTC
    const todayStart = `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekStart = `${weekAgo.toISOString().split("T")[0]}T00:00:00.000Z`;

    // Run all queries in parallel
    const [
      totalUsersResult,
      signupsTodayResult,
      signupsThisWeekResult,
      cardsLockedTodayResult,
      activeChallengesResult,
      picksMadeTodayResult,
      totalCardsResult,
    ] = await Promise.all([
      // Total users (not deactivated)
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_deactivated", false),

      // Signups today
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),

      // Signups this week
      supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", weekStart),

      // Cards locked today
      supabase
        .from("cards")
        .select("*", { count: "exact", head: true })
        .gte("locked_at", todayStart),

      // Active challenges (pending, accepted, or active)
      supabase
        .from("challenges")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "accepted", "active"]),

      // Picks made today
      supabase
        .from("picks")
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),

      // Total cards (all time)
      supabase
        .from("cards")
        .select("*", { count: "exact", head: true }),
    ]);

    // These queries return rows (not just counts), so run separately for
    // proper type inference — Promise.all with mixed return shapes causes
    // TypeScript to collapse row types to `never`.
    // Safety-capped queries: limit rows pulled into memory
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const winRateResult = await (supabase.from("leaderboard_entries") as any)
      .select("win_rate")
      .gt("total_attempted_picks", 0)
      .limit(10000);

    const dailyActiveUsersResult = await supabase
      .from("cards")
      .select("user_id")
      .gte("created_at", todayStart)
      .limit(10000);

    // Compute average win rate from fetched rows
    const winRates =
      (winRateResult.data as { win_rate: number }[] | null) ?? [];
    const avgWinRate =
      winRates.length > 0
        ? winRates.reduce((sum, row) => sum + (row.win_rate ?? 0), 0) /
          winRates.length
        : 0;

    // Compute daily active users from distinct user_ids
    const dauRows =
      (dailyActiveUsersResult.data as { user_id: string }[] | null) ?? [];
    const dailyActiveUsers = new Set(dauRows.map((r) => r.user_id)).size;

    const stats: AdminOverviewStats = {
      totalUsers: totalUsersResult.count ?? 0,
      signupsToday: signupsTodayResult.count ?? 0,
      signupsThisWeek: signupsThisWeekResult.count ?? 0,
      cardsLockedToday: cardsLockedTodayResult.count ?? 0,
      activeChallenges: activeChallengesResult.count ?? 0,
      picksMadeToday: picksMadeTodayResult.count ?? 0,
      avgWinRate: Math.round(avgWinRate * 100) / 100,
      totalCards: totalCardsResult.count ?? 0,
      dailyActiveUsers,
    };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch admin overview stats");
  }
}
