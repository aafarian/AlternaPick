import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import type { AdminSystemHealth } from "@/lib/admin/types";
import { ODDS_API_BASE_URL } from "@/lib/odds-api/constants";
import { getRecentErrors } from "@/lib/logger";

/** Lightweight call to The Odds API /v4/sports (costs 0 credits) to read credit headers. */
async function fetchOddsApiCredits(): Promise<{ remaining: number | null; used: number | null }> {
  try {
    const key = process.env.ODDS_API_KEY;
    if (!key) return { remaining: null, used: null };

    const res = await fetch(`${ODDS_API_BASE_URL}/v4/sports?apiKey=${key}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { remaining: null, used: null };

    const remaining = res.headers.get("x-requests-remaining");
    const used = res.headers.get("x-requests-used");
    return {
      remaining: remaining ? parseInt(remaining, 10) : null,
      used: used ? parseInt(used, 10) : null,
    };
  } catch {
    return { remaining: null, used: null };
  }
}

/**
 * GET /api/admin/system
 * Returns system health data: prop sync status, game schedule, and error indicators.
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

    // Compute UTC date boundaries for "today"
    const todayStart = `${new Date().toISOString().split("T")[0]}T00:00:00.000Z`;
    const todayEnd = `${new Date().toISOString().split("T")[0]}T23:59:59.999Z`;

    // Run all queries in parallel
    const [
      totalPropsResult,
      propsTodayResult,
      lastSyncResult,
      gamesScheduledResult,
      gamesLiveResult,
      gamesFinalResult,
      stalePendingPicksResult,
      stuckLockedCardsResult,
      oddsCredits,
    ] = await Promise.all([
      // Total props count
      supabase
        .from("props")
        .select("*", { count: "exact", head: true }),

      // Props fetched today
      supabase
        .from("props")
        .select("*", { count: "exact", head: true })
        .gte("fetched_at", todayStart),

      // Most recent fetched_at across all props
      supabase
        .from("props")
        .select("fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(1),

      // Games scheduled today (status = 'scheduled', commence_time within today)
      supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("status", "scheduled")
        .gte("commence_time", todayStart)
        .lte("commence_time", todayEnd),

      // Games live now
      supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("status", "live")
        .gte("commence_time", todayStart)
        .lte("commence_time", todayEnd),

      // Games final today
      supabase
        .from("games")
        .select("*", { count: "exact", head: true })
        .eq("status", "final")
        .gte("commence_time", todayStart)
        .lte("commence_time", todayEnd),

      // Error indicator: picks with result='pending' on cards with status='resolved'
      supabase
        .from("picks")
        .select("id, card_id, cards!inner(status)", { count: "exact", head: true })
        .eq("result", "pending")
        .eq("cards.status", "resolved"),

      // Error indicator: locked cards where all referenced games are final
      // We find locked cards, then check if any have games that are NOT final
      // Strategy: get locked cards with at least one pick, then filter client-side
      supabase
        .from("cards")
        .select("id, picks(prop_id, props(game_id, games(status)))")
        .eq("status", "locked"),

      // Odds API credit check (free endpoint, 0 credits)
      fetchOddsApiCredits(),
    ]);

    // Parse last sync time
    const lastSyncRows = (lastSyncResult.data as { fetched_at: string }[] | null) ?? [];
    const lastSyncAt = lastSyncRows.length > 0 ? lastSyncRows[0].fetched_at : null;

    // Calculate stuck locked cards: locked cards where ALL games referenced are 'final'
    type LockedCardRow = {
      id: string;
      picks: Array<{
        prop_id: string;
        props: { game_id: string; games: { status: string } } | null;
      }> | null;
    };
    const lockedCards = (stuckLockedCardsResult.data as LockedCardRow[] | null) ?? [];
    const stuckLockedCards = lockedCards.filter((card) => {
      const picks = card.picks ?? [];
      if (picks.length === 0) return false;
      // Card is "stuck" if it has picks and ALL referenced games are final
      return picks.every((pick) => pick.props?.games?.status === "final");
    });

    // Build error indicators as recentApiErrors entries
    const errorIndicators: AdminSystemHealth["errors"]["recentApiErrors"] = [];

    const stalePendingCount = stalePendingPicksResult.count ?? 0;
    if (stalePendingCount > 0) {
      errorIndicators.push({
        message: `${stalePendingCount} pick(s) still pending on resolved cards`,
        timestamp: new Date().toISOString(),
        endpoint: null,
      });
    }

    if (stuckLockedCards.length > 0) {
      errorIndicators.push({
        message: `${stuckLockedCards.length} locked card(s) with all games final (unresolved)`,
        timestamp: new Date().toISOString(),
        endpoint: null,
      });
    }

    // Check for stale props (none fetched in 24 hours)
    if (lastSyncAt) {
      const lastSyncDate = new Date(lastSyncAt);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (lastSyncDate < twentyFourHoursAgo) {
        errorIndicators.push({
          message: `No props fetched in 24+ hours (last sync: ${lastSyncAt})`,
          timestamp: new Date().toISOString(),
          endpoint: null,
        });
      }
    } else if ((totalPropsResult.count ?? 0) > 0) {
      // Props exist but no fetched_at found — shouldn't happen, flag it
      errorIndicators.push({
        message: "Unable to determine last prop sync time",
        timestamp: new Date().toISOString(),
        endpoint: null,
      });
    }

    const gamesTotalToday =
      (gamesScheduledResult.count ?? 0) +
      (gamesLiveResult.count ?? 0) +
      (gamesFinalResult.count ?? 0);

    const health: AdminSystemHealth = {
      propSync: {
        lastSyncAt,
        totalProps: totalPropsResult.count ?? 0,
        propsToday: propsTodayResult.count ?? 0,
        creditsRemaining: oddsCredits.remaining,
        creditsUsed: oddsCredits.used,
      },
      games: {
        scheduledToday: gamesScheduledResult.count ?? 0,
        liveNow: gamesLiveResult.count ?? 0,
        finalToday: gamesFinalResult.count ?? 0,
        totalToday: gamesTotalToday,
      },
      errors: {
        recentApiErrors: errorIndicators,
        runtimeErrors: getRecentErrors(),
      },
    };

    return NextResponse.json(health, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch system health data");
  }
}
