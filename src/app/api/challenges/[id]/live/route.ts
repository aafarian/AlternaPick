import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, notFound, handleApiError } from "@/lib/api/errors";
import {
  buildLivePicksForCard,
  fetchLiveMapsForCards,
  syncGameStatusToDb,
  type PickWithPropAndGame,
} from "@/lib/cards/live-computation";
import type {
  LiveGameStatus,
  LiveChallengeData,
  LiveParticipantData,
} from "@/lib/cards/live-types";
import { tryResolveFromLiveData } from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { logError } from "@/lib/logger";

type RouteContext = { params: Promise<{ id: string }> };

interface ChallengeCard {
  id: string;
  user_id: string | null;
  status: string;
  score: number;
  total_picks: number;
  picks: PickWithPropAndGame[];
}

interface ParticipantRow {
  user_id: string | null;
  email: string | null;
  card_id: string | null;
  status: string;
  placement: number | null;
  profile: {
    username: string;
  } | null;
}

type LiveMaps = Awaited<ReturnType<typeof fetchLiveMapsForCards>>;

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

    // Fetch challenge via admin client — RLS only allows challenger_id/opponent_id
    // which excludes group participants. Authorization is checked below.
    const admin = createAdminClient();
    const { data: challenge, error: challengeError } = await (admin.from("challenges") as any)
      .select("id, challenger_id, opponent_id, status, lobby_type")
      .eq("id", id)
      .single();

    if (challengeError || !challenge) {
      return notFound("Challenge");
    }

    const isGroup = challenge.lobby_type === "group";

    // --- Participant verification ---
    if (isGroup) {
      // For group challenges, check challenge_participants
      const { data: participantCheck } = await (admin.from("challenge_participants") as any)
        .select("id")
        .eq("challenge_id", id)
        .eq("user_id", user.id)
        .limit(1);

      if (!participantCheck || (participantCheck as { id: string }[]).length === 0) {
        return notFound("Challenge");
      }
    } else if (challenge.challenger_id !== user.id && challenge.opponent_id !== user.id) {
      // For 1v1, use existing challenger_id/opponent_id check
      return notFound("Challenge");
    }

    // Fetch all cards for this challenge using admin client (bypass RLS)
    const { data: cards } = await (admin.from("cards") as any)
      .select(
        "id, user_id, status, score, total_picks, picks(id, selection, result, actual_value, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(external_event_id, sport, status, home_team, away_team, home_score, away_score, period, clock, commence_time)))"
      )
      .eq("challenge_id", id);

    const cardsList = (cards ?? []) as ChallengeCard[];

    // Fetch live data — only for today's games, skips stale games
    const { gameStatusMap, boxscoreMap } = await fetchLiveMapsForCards(cardsList);

    // Write-through: update DB with fresh ESPN data (non-critical, don't block)
    const allPicks = cardsList.flatMap((c) => c.picks);
    syncGameStatusToDb(admin, gameStatusMap, allPicks).catch((err) => {
      logError("live-sync", `Write-through sync failed: ${err instanceof Error ? err.message : err}`, `/api/challenges/${id}/live`);
    });

    // --- Resolution ---
    // tryResolveFromLiveData handles the full pipeline: persist picks, update
    // leaderboard, send notifications, check achievements, and internally calls
    // resolveEligibleChallenges when cards are resolved.
    let challengeResolved = false;

    if (cardsList.some((c) => c.status === "locked")) {
      try {
        await tryResolveFromLiveData(cardsList, gameStatusMap, boxscoreMap);
      } catch (err) {
        logError("resolution", `tryResolveFromLiveData failed: ${err instanceof Error ? err.message : err}`, `/api/challenges/${id}/live`);
      }
    }

    // Safety net: resolve the challenge even if cards were already resolved
    // by cron (tryResolveFromLiveData only calls resolveEligibleChallenges
    // when it resolves cards itself — this covers the gap).
    if (challenge.status === "active") {
      try {
        const results = await resolveEligibleChallenges();
        challengeResolved = results.some((r) => r.challenge_id === id);
      } catch (err) {
        logError("resolution", `resolveEligibleChallenges failed: ${err instanceof Error ? err.message : err}`, `/api/challenges/${id}/live`);
      }
    }

    // --- Build response ---
    const liveMaps = { gameStatusMap, boxscoreMap };

    if (isGroup) {
      return buildGroupResponse(id, admin, user.id, cardsList, liveMaps, challengeResolved);
    }

    return buildOneVOneResponse(id, challenge, cardsList, liveMaps, challengeResolved);
  } catch (error) {
    return handleApiError(error, "Failed to fetch live challenge stats");
  }
}

/** Build the response for 1v1 challenges (backward compatible). */
function buildOneVOneResponse(
  id: string,
  challenge: { challenger_id: string; opponent_id: string | null },
  cardsList: ChallengeCard[],
  { gameStatusMap, boxscoreMap }: LiveMaps,
  challengeResolved: boolean,
): NextResponse {
  const challengerCardRaw = cardsList.find((c) => c.user_id === challenge.challenger_id) ?? null;
  const opponentCardRaw = cardsList.find((c) => c.user_id === challenge.opponent_id) ?? null;

  const challengerLive = challengerCardRaw
    ? buildLivePicksForCard(challengerCardRaw.picks, gameStatusMap, boxscoreMap)
    : null;

  const opponentLive = opponentCardRaw
    ? buildLivePicksForCard(opponentCardRaw.picks, gameStatusMap, boxscoreMap)
    : null;

  const seenGames = new Set<string>();
  const games: LiveGameStatus[] = [];
  for (const result of [challengerLive, opponentLive]) {
    if (!result) continue;
    for (const g of result.games) {
      if (!seenGames.has(g.external_event_id)) {
        seenGames.add(g.external_event_id);
        games.push(g);
      }
    }
  }

  const allFinal =
    (challengerLive !== null || opponentLive !== null) &&
    (challengerLive?.allGamesFinal ?? true) &&
    (opponentLive?.allGamesFinal ?? true);

  const response: LiveChallengeData = {
    challenge_id: id,
    challenger_card: challengerLive
      ? {
          card_id: challengerCardRaw!.id,
          picks: challengerLive.livePicks,
          has_live_games: challengerLive.hasLiveGames,
          all_games_final: challengerLive.allGamesFinal,
        }
      : null,
    opponent_card: opponentLive
      ? {
          card_id: opponentCardRaw!.id,
          picks: opponentLive.livePicks,
          has_live_games: opponentLive.hasLiveGames,
          all_games_final: opponentLive.allGamesFinal,
        }
      : null,
    games,
    has_live_games: (challengerLive?.hasLiveGames || opponentLive?.hasLiveGames) ?? false,
    all_games_final: allFinal,
    challenge_resolved: challengeResolved || undefined,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}

/** Build the response for group challenges with participants array. */
async function buildGroupResponse(
  id: string,
  admin: ReturnType<typeof createAdminClient>,
  requestingUserId: string,
  cardsList: ChallengeCard[],
  { gameStatusMap, boxscoreMap }: LiveMaps,
  challengeResolved: boolean,
): Promise<NextResponse> {
  // Fetch participants with profile data
  const { data: participantRows } = await (admin.from("challenge_participants") as any)
    .select(
      "user_id, email, card_id, status, placement, profile:profiles!challenge_participants_user_id_fkey(username)"
    )
    .eq("challenge_id", id)
    .order("created_at", { ascending: true });

  const participants = (participantRows ?? []) as ParticipantRow[];

  // Build a map of card_id -> ChallengeCard for quick lookup
  const cardMap = new Map<string, ChallengeCard>();
  for (const card of cardsList) {
    cardMap.set(card.id, card);
  }

  // Determine if the requesting user has locked their card (for pick privacy)
  const requestingParticipant = participants.find((p) => p.user_id === requestingUserId);
  const requestingCardId = requestingParticipant?.card_id;
  const requestingCard = requestingCardId ? cardMap.get(requestingCardId) : undefined;
  const requestingUserHasLocked = requestingCard?.status === "locked" || requestingCard?.status === "resolved";

  // Build live data for each participant
  const seenGames = new Set<string>();
  const games: LiveGameStatus[] = [];
  let hasLiveGames = false;
  let allFinal = true;
  let anyCard = false;

  const liveParticipants: LiveParticipantData[] = participants.map((p) => {
    const card = p.card_id ? cardMap.get(p.card_id) : undefined;
    const isRequestingUser = p.user_id === requestingUserId;

    if (!card) {
      return {
        user_id: p.user_id,
        username: p.profile?.username ?? null,
        email: p.email,
        card: null,
        placement: p.placement ?? undefined,
        status: p.status,
      };
    }

    const liveResult = buildLivePicksForCard(card.picks, gameStatusMap, boxscoreMap);

    // Collect games from all cards for the deduplicated games list
    for (const g of liveResult.games) {
      if (!seenGames.has(g.external_event_id)) {
        seenGames.add(g.external_event_id);
        games.push(g);
      }
    }

    anyCard = true;
    if (liveResult.hasLiveGames) hasLiveGames = true;
    if (!liveResult.allGamesFinal) allFinal = false;

    // Pick privacy: if the requesting user hasn't locked, hide other participants' picks
    const shouldHidePicks = !isRequestingUser && !requestingUserHasLocked;

    return {
      user_id: p.user_id,
      username: p.profile?.username ?? null,
      email: p.email,
      card: {
        card_id: card.id,
        picks: shouldHidePicks ? [] : liveResult.livePicks,
        has_live_games: liveResult.hasLiveGames,
        all_games_final: liveResult.allGamesFinal,
      },
      placement: p.placement ?? undefined,
      status: p.status,
    };
  });

  const response: LiveChallengeData = {
    challenge_id: id,
    challenger_card: null,
    opponent_card: null,
    participants: liveParticipants,
    games,
    has_live_games: hasLiveGames,
    all_games_final: anyCard && allFinal,
    challenge_resolved: challengeResolved || undefined,
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
