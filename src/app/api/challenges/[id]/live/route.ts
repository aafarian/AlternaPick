import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  fetchBoxscoreLive,
  fetchTodaysGamesLive,
  type PlayerBoxScore,
  type StatsGame,
} from "@/lib/stats-service/client";
import { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import type {
  LivePickData,
  LiveGameStatus,
  LiveChallengeData,
} from "@/lib/cards/live-types";

type RouteContext = { params: Promise<{ id: string }> };

interface CardPickWithProp {
  id: string;
  selection: PickSelection;
  props: {
    player_name: string;
    player_id: string | null;
    stat_category: StatCategory;
    line: number;
    game_id: string;
    games: {
      nba_game_id: string | null;
    };
  };
}

interface ChallengeCard {
  id: string;
  user_id: string | null;
  status: string;
  score: number;
  total_picks: number;
  picks: CardPickWithProp[];
}

// LiveChallengeData type is defined in @/lib/cards/live-types

function buildLivePicksFromCard(
  card: ChallengeCard,
  gameStatusMap: Map<string, StatsGame>,
  boxscoreMap: Map<string, PlayerBoxScore[]>,
  liveGamesSet: Set<string>
): { picks: LivePickData[]; hasLive: boolean } {
  let hasLive = false;
  const picks: LivePickData[] = [];

  for (const pick of card.picks) {
    const nbaGameId = pick.props?.games?.nba_game_id;
    const gameInfo = nbaGameId ? gameStatusMap.get(nbaGameId) : null;

    let gameStatus: LiveGameStatus | null = null;
    if (gameInfo && nbaGameId) {
      gameStatus = {
        game_id: pick.props.game_id,
        nba_game_id: nbaGameId,
        status: gameInfo.status as "scheduled" | "live" | "final",
        period: gameInfo.period,
        clock: gameInfo.clock,
        home_team: gameInfo.home_team,
        away_team: gameInfo.away_team,
        home_tricode: gameInfo.home_tricode,
        away_tricode: gameInfo.away_tricode,
        home_score: gameInfo.home_score,
        away_score: gameInfo.away_score,
      };
      if (gameInfo.status === "live") {
        liveGamesSet.add(nbaGameId);
        hasLive = true;
      }
    }

    let currentValue: number | null = null;
    let trending: "hit" | "miss" | "push" | null = null;

    if (nbaGameId && (gameInfo?.status === "live" || gameInfo?.status === "final")) {
      const boxscore = boxscoreMap.get(nbaGameId) ?? [];
      const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

      if (playerStats) {
        currentValue = extractStatValue(playerStats, pick.props.stat_category);

        if (currentValue === pick.props.line) {
          trending = "push";
        } else if (
          (pick.selection === "over" && currentValue > pick.props.line) ||
          (pick.selection === "under" && currentValue < pick.props.line)
        ) {
          trending = "hit";
        } else {
          trending = "miss";
        }
      }
    }

    picks.push({
      pick_id: pick.id,
      player_name: pick.props.player_name,
      player_id: pick.props.player_id,
      stat_category: pick.props.stat_category,
      line: pick.props.line,
      selection: pick.selection,
      current_value: currentValue,
      trending,
      game_status: gameStatus,
    });
  }

  return { picks, hasLive };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { id } = await context.params;

    // Verify user is a participant
    const { data: challenge, error: challengeError } = await (supabase.from("challenges") as any)
      .select("id, challenger_id, opponent_id, status")
      .eq("id", id)
      .single();

    if (challengeError || !challenge) {
      return notFound("Challenge");
    }

    if (challenge.challenger_id !== user.id && challenge.opponent_id !== user.id) {
      return notFound("Challenge");
    }

    // Fetch both players' cards using admin client (bypass RLS for opponent's card)
    const admin = createAdminClient();
    const { data: cards } = await (admin.from("cards") as any)
      .select(
        "id, user_id, status, score, total_picks, picks(id, selection, props(player_name, player_id, stat_category, line, game_id, games(nba_game_id)))"
      )
      .eq("challenge_id", id);

    const cardsList = (cards ?? []) as ChallengeCard[];

    // Collect all nba_game_ids from both cards
    const nbaGameIds = new Set<string>();
    for (const card of cardsList) {
      for (const pick of card.picks) {
        const nbaId = pick.props?.games?.nba_game_id;
        if (nbaId) nbaGameIds.add(nbaId);
      }
    }

    // Fetch live games + boxscores in parallel
    const [todaysGames, ...boxscoreResults] = await Promise.all([
      fetchTodaysGamesLive().catch(() => [] as StatsGame[]),
      ...Array.from(nbaGameIds).map((gid) =>
        fetchBoxscoreLive(gid).catch(() => [] as PlayerBoxScore[])
      ),
    ]);

    const gameStatusMap = new Map<string, StatsGame>();
    for (const g of todaysGames) {
      gameStatusMap.set(g.game_id, g);
    }

    const boxscoreMap = new Map<string, PlayerBoxScore[]>();
    const gameIdArr = Array.from(nbaGameIds);
    for (let i = 0; i < gameIdArr.length; i++) {
      boxscoreMap.set(gameIdArr[i], boxscoreResults[i]);
    }

    const liveGamesSet = new Set<string>();

    const challengerCardRaw = cardsList.find((c) => c.user_id === challenge.challenger_id) ?? null;
    const opponentCardRaw = cardsList.find((c) => c.user_id === challenge.opponent_id) ?? null;

    const challengerLive = challengerCardRaw
      ? buildLivePicksFromCard(challengerCardRaw, gameStatusMap, boxscoreMap, liveGamesSet)
      : null;

    const opponentLive = opponentCardRaw
      ? buildLivePicksFromCard(opponentCardRaw, gameStatusMap, boxscoreMap, liveGamesSet)
      : null;

    // Build unique games list
    const seenGames = new Set<string>();
    const games: LiveGameStatus[] = [];
    const allPicks = [
      ...(challengerLive?.picks ?? []),
      ...(opponentLive?.picks ?? []),
    ];
    for (const pick of allPicks) {
      if (pick.game_status && !seenGames.has(pick.game_status.nba_game_id)) {
        seenGames.add(pick.game_status.nba_game_id);
        games.push(pick.game_status);
      }
    }

    const response: LiveChallengeData = {
      challenge_id: id,
      challenger_card: challengerLive
        ? {
            card_id: challengerCardRaw!.id,
            picks: challengerLive.picks,
            has_live_games: challengerLive.hasLive,
          }
        : null,
      opponent_card: opponentLive
        ? {
            card_id: opponentCardRaw!.id,
            picks: opponentLive.picks,
            has_live_games: opponentLive.hasLive,
          }
        : null,
      games,
      has_live_games: liveGamesSet.size > 0,
    };

    return NextResponse.json(response);
  } catch (error) {
    return handleApiError(error, "Failed to fetch live challenge stats");
  }
}
