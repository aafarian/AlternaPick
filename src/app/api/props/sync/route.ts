import { NextRequest, NextResponse } from "next/server";
import { isCacheStale, cacheProps } from "@/lib/odds-api/cache";
import { fetchAllProps } from "@/lib/odds-api/client";

export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!process.env.ODDS_API_KEY) {
    return NextResponse.json(
      { error: "ODDS_API_KEY is not configured" },
      { status: 500 }
    );
  }

  try {
    const stale = await isCacheStale();

    if (!stale) {
      return NextResponse.json({
        synced: false,
        message: "Cache is fresh, no sync needed",
      });
    }

    const { events, props: propsMap, credits } = await fetchAllProps();

    await cacheProps(events, propsMap);

    let totalProps = 0;
    for (const props of propsMap.values()) {
      totalProps += props.length;
    }

    return NextResponse.json({
      synced: true,
      gamesCount: events.length,
      propsCount: totalProps,
      creditsRemaining: credits.remaining,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message.includes("429") || message.includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limited by Odds API. Try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to sync props", message },
      { status: 502 }
    );
  }
}
