import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import type { AdminSystemHealth } from "@/lib/admin/types";
import { fetchOddsApiCredits } from "@/lib/odds-api/client";
import { getRecentErrors, logWarn } from "@/lib/logger";

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
      creditDrainResult,
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

      // Error indicator: picks with result='pending' on resolved cards where game is final.
      // Live/scheduled games are expected to have pending picks — not an error.
      // Include player/game details so admin can debug.
      supabase
        .from("picks")
        .select("id, card_id, props(player_name, stat_category, line, player_team, games(status, home_team, away_team, sport, external_event_id)), cards!inner(status)")
        .eq("result", "pending")
        .eq("cards.status", "resolved"),

      // Error indicator: locked cards where all referenced games are final
      // Include pick/user details so admin can see which cards are stuck
      supabase
        .from("cards")
        .select("id, locked_at, user_id, profiles!cards_user_id_fkey(username), picks(result, props(player_name, stat_category, line, games(status)))")
        .eq("status", "locked"),

      // Odds API credit check (free endpoint, 0 credits)
      fetchOddsApiCredits(),

      // Hourly credit usage (last 24h)
      supabase.rpc("get_credit_usage_by_hour"),
    ]);

    // Parse last sync time
    const lastSyncRows = (lastSyncResult.data as { fetched_at: string }[] | null) ?? [];
    const lastSyncAt = lastSyncRows.length > 0 ? lastSyncRows[0].fetched_at : null;

    // Calculate stuck locked cards: locked cards where ALL games referenced are 'final'
    type LockedCardRow = {
      id: string;
      locked_at: string | null;
      user_id: string | null;
      profiles: { username: string } | null;
      picks: Array<{
        result: string;
        props: {
          player_name: string;
          stat_category: string;
          line: number;
          games: { status: string } | null;
        } | null;
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

    // Only count pending picks where the game is final — live/scheduled games will resolve naturally
    type StalePendingRow = {
      id: string;
      card_id: string;
      props: {
        player_name: string;
        stat_category: string;
        line: number;
        player_team: string | null;
        games: {
          status: string;
          home_team: string;
          away_team: string;
          sport: string | null;
          external_event_id: string | null;
        } | null;
      } | null;
    };
    const stalePendingRows = (stalePendingPicksResult.data as StalePendingRow[] | null) ?? [];
    const stalePendingFinal = stalePendingRows.filter(
      (row) => row.props?.games?.status === "final",
    );
    if (stalePendingFinal.length > 0) {
      errorIndicators.push({
        message: `${stalePendingFinal.length} pick(s) still pending on resolved cards`,
        timestamp: new Date().toISOString(),
        endpoint: null,
        stalePicks: stalePendingFinal.map((row) => ({
          pickId: row.id,
          cardId: row.card_id,
          player: row.props?.player_name ?? "Unknown",
          stat: row.props?.stat_category ?? "Unknown",
          line: row.props?.line ?? 0,
          team: row.props?.player_team ?? null,
          sport: row.props?.games?.sport ?? null,
          game: row.props?.games
            ? `${row.props.games.home_team} vs ${row.props.games.away_team}`
            : null,
          eventId: row.props?.games?.external_event_id ?? null,
        })),
      });
    }

    if (stuckLockedCards.length > 0) {
      errorIndicators.push({
        message: `${stuckLockedCards.length} locked card(s) with all games final (unresolved)`,
        timestamp: new Date().toISOString(),
        endpoint: null,
        lockedCards: stuckLockedCards.map((card) => ({
          cardId: card.id,
          username: card.profiles?.username ?? null,
          lockedAt: card.locked_at,
          pickCount: card.picks?.length ?? 0,
          picks: (card.picks ?? []).map((p) => ({
            player: p.props?.player_name ?? "Unknown",
            stat: p.props?.stat_category ?? "Unknown",
            line: p.props?.line ?? 0,
            result: p.result,
            gameStatus: p.props?.games?.status ?? null,
          })),
        })),
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
        creditUsageByHour: (() => {
          if (creditDrainResult.error) {
            logWarn("admin", `get_credit_usage_by_hour RPC error: ${creditDrainResult.error.message}`, "/api/admin/system");
          }
          const rows = (creditDrainResult.data as { hour: string; credits: string | number }[] | null) ?? [];
          return rows.map((r) => ({ hour: r.hour, credits: Number(r.credits) }));
        })(),
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
