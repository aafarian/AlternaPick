import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchTodaysGames } from "@/lib/stats-service/client";
import type { Game } from "@/lib/supabase/types";

// Map NBA.com tricodes to Odds API full team names
const TRICODE_TO_TEAM: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

function mapNbaStatus(status: string): "scheduled" | "live" | "final" {
  const s = status.toLowerCase();
  if (s.includes("final")) return "final";
  if (s.includes("live") || s.includes("progress") || s.includes("half"))
    return "live";
  return "scheduled";
}

export async function POST(request: NextRequest) {
  // Auth check
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const nbaGames = await fetchTodaysGames();

    if (nbaGames.length === 0) {
      return NextResponse.json({ updated: 0, games: [], message: "No NBA games today" });
    }

    const supabase = await createClient();

    // Get today's games from Supabase
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const gamesResult = await supabase
      .from("games")
      .select("*")
      .gte("commence_time", todayStart.toISOString())
      .lte("commence_time", tomorrowEnd.toISOString());

    if (gamesResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch games from DB", message: gamesResult.error.message },
        { status: 500 }
      );
    }

    const games = (gamesResult.data ?? []) as Game[];
    const updated: { odds_team: string; nba_team: string; status: string; nba_game_id: string }[] = [];

    for (const nbaGame of nbaGames) {
      const homeTeamFull = TRICODE_TO_TEAM[nbaGame.home_tricode];
      const awayTeamFull = TRICODE_TO_TEAM[nbaGame.away_tricode];

      // Find matching DB game by team names
      const match = games.find((g) => {
        const homeMatch =
          g.home_team === homeTeamFull ||
          g.home_team.includes(nbaGame.home_team) ||
          nbaGame.home_team.includes(g.home_team.split(" ").pop() ?? "");
        const awayMatch =
          g.away_team === awayTeamFull ||
          g.away_team.includes(nbaGame.away_team) ||
          nbaGame.away_team.includes(g.away_team.split(" ").pop() ?? "");
        return homeMatch && awayMatch;
      });

      if (!match) continue;

      const newStatus = mapNbaStatus(nbaGame.status);

      const { error: updateError } = await (supabase.from("games") as any)
        .update({
          status: newStatus,
          home_score: nbaGame.home_score,
          away_score: nbaGame.away_score,
          nba_game_id: nbaGame.game_id,
        })
        .eq("id", match.id);

      if (!updateError) {
        updated.push({
          odds_team: `${match.away_team} @ ${match.home_team}`,
          nba_team: `${nbaGame.away_team} @ ${nbaGame.home_team}`,
          status: newStatus,
          nba_game_id: nbaGame.game_id,
        });
      }
    }

    return NextResponse.json({ updated: updated.length, games: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to sync game statuses", message },
      { status: 500 }
    );
  }
}
