import { type NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { isSyncOverlapping, getEventIdsWithProps, cacheProps, PROPS_CACHE_TAG } from "@/lib/odds-api/cache";
import { fetchAllPropsAndLogCredits } from "@/lib/odds-api/client";
import type { SportKey } from "@/lib/odds-api/constants";
import { serverError, tooManyRequests, handleApiError } from "@/lib/api/errors";

/**
 * POST /api/admin/resync/props?force=true
 *
 * Admin-authenticated prop sync. Same logic as /api/props/sync but
 * guarded by admin session instead of SYNC_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    if (!process.env.ODDS_API_KEY) {
      return serverError("ODDS_API_KEY is not configured");
    }

    const force = request.nextUrl.searchParams.get("force") === "true";

    if (!force) {
      const overlapping = await isSyncOverlapping();
      if (overlapping) {
        return NextResponse.json({
          synced: false,
          message: "Sync ran recently (within 5 min), skipping to prevent overlap",
        });
      }
    }

    const skipEventIds = force ? undefined : await getEventIdsWithProps();
    const multiResults = await fetchAllPropsAndLogCredits(skipEventIds);

    let totalGames = 0;
    let totalProps = 0;
    let latestCreditsRemaining: number | null = null;
    const enrichment: Record<string, { enriched: number; total: number; playerMapSize: number }> = {};

    for (const [sport, { events, props: propsMap, credits }] of multiResults) {
      const result = await cacheProps(events, propsMap, sport);

      totalGames += events.length;
      let sportProps = 0;
      for (const props of propsMap.values()) {
        sportProps += props.length;
      }
      totalProps += sportProps;
      enrichment[sport] = {
        enriched: result.propsEnriched,
        total: sportProps,
        playerMapSize: result.playerMapSize,
      };
      if (credits.remaining !== null) {
        latestCreditsRemaining = credits.remaining;
      }
    }

    revalidateTag(PROPS_CACHE_TAG, "max");

    const warnings: string[] = [];
    if (totalProps === 0) {
      warnings.push("No props fetched — games may have already started, be off-season, or API credits may be exhausted");
    }
    if (latestCreditsRemaining !== null && latestCreditsRemaining < 50) {
      warnings.push(`Low API credits: ${latestCreditsRemaining} remaining`);
    }
    if (multiResults.size < 3) {
      const fetched = Array.from(multiResults.keys());
      const missing = ["nba", "epl", "ncaab"].filter((s) => !fetched.includes(s as SportKey));
      if (missing.length > 0) {
        warnings.push(`Failed to fetch props for: ${missing.join(", ")}`);
      }
    }

    return NextResponse.json({
      synced: true,
      gamesCount: totalGames,
      propsCount: totalProps,
      eventsSkipped: skipEventIds?.size ?? 0,
      creditsRemaining: latestCreditsRemaining,
      sports: Array.from(multiResults.keys()),
      enrichment,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("429") || message.includes("rate limit")) {
      return tooManyRequests("Rate limited by Odds API. Try again later.");
    }

    return handleApiError(error, "Failed to sync props");
  }
}
