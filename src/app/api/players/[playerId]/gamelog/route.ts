import { NextRequest, NextResponse } from "next/server";
import { fetchPlayerGamelog } from "@/lib/stats-service/client";

const VALID_SPORTS = new Set(["nba", "ncaab"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const { playerId } = await params;
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport") ?? "nba";
  const playerName = searchParams.get("name") ?? undefined;
  const lastN = Math.min(
    Math.max(parseInt(searchParams.get("last_n") ?? "5", 10) || 5, 1),
    20
  );

  if (!VALID_SPORTS.has(sport)) {
    return NextResponse.json({ data: { games: [], season_averages: null } });
  }

  try {
    const data = await fetchPlayerGamelog(playerId, sport, lastN, playerName);

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": "public, max-age=900, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error(`[gamelog] Failed for player=${playerId} sport=${sport}:`, error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch game log";
    const status =
      error instanceof Error && "status" in error
        ? (error as { status: number }).status
        : 503;

    return NextResponse.json({ error: message }, { status });
  }
}
