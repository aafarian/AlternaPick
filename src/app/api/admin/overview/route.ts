import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import type { AdminOverviewStats } from "@/lib/admin/types";

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

    // Compute date boundaries using US Eastern to match admin's perspective.
    // new Date(y, m, d) gives local midnight; .toISOString() converts to UTC.
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();

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

    // Fail fast on any count-query errors instead of silently returning 0
    const countResults = [
      totalUsersResult, signupsTodayResult, signupsThisWeekResult,
      cardsLockedTodayResult, activeChallengesResult, picksMadeTodayResult,
      totalCardsResult,
    ];
    for (const r of countResults) {
      if (r.error) throw new Error(r.error.message);
    }

    // These queries return rows (not just counts), so run separately for
    // proper type inference — Promise.all with mixed return shapes causes
    // TypeScript to collapse row types to `never`.
    // Safety-capped queries: limit rows pulled into memory
     
    const winRateResult = await (supabase.from("leaderboard_entries") as any)
      .select("win_rate")
      .gt("total_attempted_picks", 0)
      .limit(10000);
    if (winRateResult.error) throw new Error(winRateResult.error.message);

    // DAU: combine middleware-tracked visits with actual activity signals.
    // Users in real-time sessions (e.g. group challenge lobbies) don't trigger
    // HTTP middleware, so last_active_at alone undercounts.
    const [dauProfilesResult, dauCardsResult, dauPicksResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .gte("last_active_at", todayStart)
        .limit(10000),
      supabase
        .from("cards")
        .select("user_id")
        .gte("created_at", todayStart)
        .not("user_id", "is", null)
        .limit(10000),
      supabase
        .from("picks")
        .select("cards!picks_card_id_fkey(user_id)")
        .gte("created_at", todayStart)
        .limit(10000),
    ]);
    if (dauProfilesResult.error) throw new Error(dauProfilesResult.error.message);
    if (dauCardsResult.error) throw new Error(dauCardsResult.error.message);
    if (dauPicksResult.error) throw new Error(dauPicksResult.error.message);

    const activeUserIds = new Set<string>();
    for (const row of (dauProfilesResult.data ?? []) as { id: string }[]) {
      activeUserIds.add(row.id);
    }
    for (const row of (dauCardsResult.data ?? []) as { user_id: string }[]) {
      activeUserIds.add(row.user_id);
    }
    for (const row of (dauPicksResult.data ?? []) as { cards: { user_id: string } | null }[]) {
      if (row.cards?.user_id) activeUserIds.add(row.cards.user_id);
    }

    // Compute average win rate from fetched rows
    const winRates =
      (winRateResult.data as { win_rate: number }[] | null) ?? [];
    const avgWinRate =
      winRates.length > 0
        ? winRates.reduce((sum, row) => sum + (row.win_rate ?? 0), 0) /
          winRates.length
        : 0;

    const dailyActiveUsers = activeUserIds.size;

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
