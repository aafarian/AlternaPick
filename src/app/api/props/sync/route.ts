import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isCacheStale, cacheProps, PROPS_CACHE_TAG } from "@/lib/odds-api/cache";
import { fetchAllPropsMultiSport } from "@/lib/odds-api/client";
import { unauthorized, tooManyRequests, serverError, handleApiError } from "@/lib/api/errors";

export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return unauthorized();
    }
  }

  if (!process.env.ODDS_API_KEY) {
    return serverError("ODDS_API_KEY is not configured");
  }

  try {
    const force = request.nextUrl.searchParams.get("force") === "true";
    const stale = force || await isCacheStale();

    if (!stale) {
      return NextResponse.json({
        synced: false,
        message: "Cache is fresh, no sync needed",
      });
    }

    const multiResults = await fetchAllPropsMultiSport();

    let totalGames = 0;
    let totalProps = 0;
    let latestCreditsRemaining: number | null = null;

    for (const [sport, { events, props: propsMap, credits }] of multiResults) {
      await cacheProps(events, propsMap, sport);

      totalGames += events.length;
      for (const props of propsMap.values()) {
        totalProps += props.length;
      }
      if (credits.remaining !== null) {
        latestCreditsRemaining = credits.remaining;
      }
    }

    // Invalidate the props page cache so next load gets fresh data
    revalidateTag(PROPS_CACHE_TAG, "max");

    return NextResponse.json({
      synced: true,
      gamesCount: totalGames,
      propsCount: totalProps,
      creditsRemaining: latestCreditsRemaining,
      sports: Array.from(multiResults.keys()),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message.includes("429") || message.includes("rate limit")) {
      return tooManyRequests("Rate limited by Odds API. Try again later.");
    }

    return handleApiError(error, "Failed to sync props");
  }
}
