import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import { logWarn } from "@/lib/logger";
import type { AdminOverviewStats } from "@/lib/admin/types";

const DAU_ROW_LIMIT = 10000;
const ADMIN_TIMEZONE = "America/New_York";

/**
 * Returns the UTC ISO timestamp for the start of "today" (midnight) in the
 * admin timezone. This matches how an admin in ET perceives the day boundary,
 * even though the server itself runs in UTC.
 *
 * Implementation: format `now` in the target timezone to extract its
 * year/month/day components, then build a Date for that date at the timezone's
 * UTC offset for that moment. Falls back to UTC midnight if Intl is unavailable.
 */
function startOfDayInTimezone(now: Date, timeZone: string, dayOffset = 0): string {
  // Get y/m/d in the target timezone
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  // Compute the target timezone's offset from UTC for `now` (in minutes).
  // We do this by formatting `now` in the timezone with longOffset and parsing.
  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const offsetPart = offsetFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value;
  // offsetPart looks like "GMT-05:00" or "GMT" for UTC
  let offsetMinutes = 0;
  if (offsetPart && offsetPart.startsWith("GMT")) {
    const sign = offsetPart[3] === "-" ? -1 : 1;
    const rest = offsetPart.slice(4);
    if (rest) {
      const [hh, mm] = rest.split(":").map(Number);
      offsetMinutes = sign * (hh * 60 + (mm ?? 0));
    }
  }

  // Build local midnight as if it were UTC, then subtract the offset to get
  // the actual UTC instant that corresponds to local midnight.
  const localMidnightAsUtc = Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0, 0);
  const utcInstant = localMidnightAsUtc - offsetMinutes * 60 * 1000;
  return new Date(utcInstant).toISOString();
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

    // Compute date boundaries in the admin's timezone (ET) so "today" matches
    // what an East Coast admin sees, regardless of the server's local TZ.
    const now = new Date();
    const todayStart = startOfDayInTimezone(now, ADMIN_TIMEZONE);
    const weekStart = startOfDayInTimezone(now, ADMIN_TIMEZONE, -7);

    // Run all queries in parallel
    const [
      totalUsersResult,
      signupsTodayResult,
      signupsThisWeekResult,
      cardsLockedTodayResult,
      activeChallengesResult,
      picksMadeTodayResult,
      totalCardsResult,
      wageredCardsTodayResult,
      questsCompletedTodayResult,
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

      // Wagered cards today
      (supabase.from("cards") as any)
        .select("*", { count: "exact", head: true })
        .gte("locked_at", todayStart)
        .not("fire_token_wager", "is", null),

      // Quest rewards claimed today
      (supabase.from("quest_rewards") as any)
        .select("*", { count: "exact", head: true })
        .eq("reward_date", todayStart.slice(0, 10)),
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
        .eq("is_deactivated", false)
        .limit(DAU_ROW_LIMIT),
      supabase
        .from("cards")
        .select("user_id")
        .gte("created_at", todayStart)
        .not("user_id", "is", null)
        .limit(DAU_ROW_LIMIT),
      // picks has no user_id column — join through cards to get the card author,
      // who IS the user that made the picks (each card belongs to a single user).
      supabase
        .from("picks")
        .select("cards!picks_card_id_fkey(user_id)")
        .gte("created_at", todayStart)
        .limit(DAU_ROW_LIMIT),
    ]);
    if (dauProfilesResult.error) throw new Error(dauProfilesResult.error.message);
    if (dauCardsResult.error) throw new Error(dauCardsResult.error.message);
    if (dauPicksResult.error) throw new Error(dauPicksResult.error.message);

    // Warn if any query hit the row limit — DAU count may be an undercount
    const dauResults = [dauProfilesResult.data, dauCardsResult.data, dauPicksResult.data];
    for (const rows of dauResults) {
      if (rows && rows.length >= DAU_ROW_LIMIT) {
        logWarn("admin", `DAU query hit ${DAU_ROW_LIMIT} row limit — count may be underreported`, new Error("DAU row limit reached"));
        break;
      }
    }

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

    // WAU: profiles with last_active_at in the last 7 days
    const wauResult = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", weekStart)
      .eq("is_deactivated", false);

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
      weeklyActiveUsers: wauResult.count ?? 0,
      wageredCardsToday: wageredCardsTodayResult.count ?? 0,
      questsCompletedToday: questsCompletedTodayResult.count ?? 0,
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
