import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getCardResolvedEmailProps } from "@/lib/email/templates/card-resolved";
import { getCardTier } from "@/lib/cards/tiers";
import { logError, logWarn } from "@/lib/logger";
import {
  type PlayerBoxScore,
  type StatsGame,
  fetchNbaGamesByDate,
  fetchSoccerGamesByDate,
  fetchLaLigaGamesByDate,
  fetchCopaDelReyGamesByDate,
  fetchNcaabGamesByDate,
} from "@/lib/stats-service/client";
import { getBoxscoreFetcher, lookbackDatesForSport } from "@/lib/sports/fetchers";
import { teamsMatch } from "@/lib/team-matching";
import { isSoccer } from "@/lib/sports/config";
import type { PickWithPropAndGame } from "@/lib/cards/live-computation";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import { bootNonActiveParticipantsAfterResolution } from "@/lib/challenges/queries";
import type {
  Card,
  Pick,
  Prop,
  Game,
  StatCategory,
  PickResult,
  NotificationPreferences,
} from "@/lib/supabase/types";
import { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution-utils";
import {
  computeCardHeatScore,
  computeFireTokenPayout,
  computeQualityBonus,
  getNotchTier,
  HEATSCORE_HIT_BASE,
} from "@/lib/heatscore/compute";
import { DEFAULT_LEADERBOARD_STATS } from "@/lib/leaderboard/defaults";

// Re-export pure functions so existing imports from resolution.ts continue to work
export { extractStatValue, fuzzyMatchPlayer } from "@/lib/cards/resolution-utils";

export interface PickResolution {
  pick_id: string;
  prop_id: string;
  player_name: string;
  stat_category: StatCategory;
  line: number;
  selection: "over" | "under";
  actual_value: number | null;
  result: PickResult;
  notch: number;
  /** Per-pick HeatScore contribution (base × notch + quality). */
  heat_score: number;
}

export interface ResolutionResult {
  card_id: string;
  user_id: string | null;
  challenge_id: string | null;
  score: number;
  total: number;
  picks: PickResolution[];
  /** HeatScore multiplier × 100 (e.g., 250 = 2.5x). Null if no scoreable picks. */
  heat_score: number | null;
  /** Flame Token payout. Null if card had no wager. */
  fire_token_wager: number | null;
  fire_token_payout: number | null;
  /** Total quality bonus (flat tokens from margins). */
  quality_bonus: number;
}

type PickWithProp = Pick & {
  props: Prop & { games: Game & { sport?: string } };
};

function buildPickResolution(
  pick: PickWithProp,
  overrides: { result: PickResult; actual_value: number | null; line?: number; heat_score?: number },
): PickResolution {
  return {
    pick_id: pick.id,
    prop_id: pick.prop_id,
    player_name: pick.props?.player_name ?? "Unknown",
    stat_category: pick.props?.stat_category ?? "points",
    line: overrides.line ?? pick.props?.line ?? 0,
    selection: pick.selection,
    actual_value: overrides.actual_value,
    result: overrides.result,
    notch: pick.notch ?? 0,
    heat_score: overrides.heat_score ?? 0,
  };
}

/** Returns true when the game's commence_time is in the past (safe to treat as played). */
function hasGameStarted(commenceTime: string | null | undefined): boolean {
  if (!commenceTime) return true; // no time recorded → assume past game
  return new Date(commenceTime).getTime() <= Date.now();
}

export async function resolveEligibleCards(): Promise<ResolutionResult[]> {
  const supabase = createAdminClient();

  // Get locked cards with their picks, props, and games
  const cardsResult = await (supabase.from("cards") as any)
    .select("*, picks(*, props(*, games(*)))")
    .eq("status", "locked");

  if (cardsResult.error) {
    throw new Error(`Failed to fetch cards: ${cardsResult.error.message}`);
  }

  const cards = cardsResult.data as (Card & { picks: PickWithProp[] })[];
  const results: ResolutionResult[] = [];

  // Cache boxscores per ESPN event ID to minimize API calls
  const boxscoreCache = new Map<string, PlayerBoxScore[]>();

  for (const card of cards) {
    // All games must be final and started. If a pick is missing its
    // external_event_id we can still resolve the card — the pick will be
    // marked as "push" in resolveCard() since we can't fetch boxscore data.
    const allResolvable = card.picks.every(
      (pick) =>
        pick.props?.games?.status === "final" &&
        hasGameStarted(pick.props?.games?.commence_time)
    );
    if (!allResolvable) continue;

    const result = await resolveCard(card, boxscoreCache);
    if (result) {
      const resolved = await persistResolution(supabase, result);
      if (!resolved) continue; // Already resolved by another caller

      if (result.total > 0) {
        await handlePostResolution(supabase, result);
      } else if (result.user_id) {
        // All picks DNP/voided — still notify the user their card resolved
        await createNotification(supabase, {
          user_id: result.user_id,
          type: "card_resolved",
          title: "No Contest",
          body: "Your card resolved with no scoreable picks.",
          metadata: { card_id: result.card_id },
        }, null).catch((err) => { logWarn("resolution", "Failed to send no-contest notification", err); });
      }
      results.push(result);
    }
  }

  // Resolve eligible challenges if any cards were resolved
  if (results.length > 0) {
    try {
      await resolveEligibleChallenges();
    } catch (err) {
      logError("resolution", "Failed to resolve challenges", undefined, err);
    }
  }

  return results;
}

/**
 * Re-resolve picks on already-resolved cards that have null actual_value.
 * This handles cases where resolution ran before boxscore data was available
 * on ESPN (common with NCAAB games that just ended).
 */
export type ReResolvePickLog = {
  player: string;
  stat: string;
  line: number;
  selection: string;
  oldResult: string;
  newResult: string;
  actualValue: number | null;
  sport: string | null;
  gameStatus: string | null;
};

export type ReResolveSkipLog = {
  player: string;
  stat: string;
  reason: string;
  sport: string | null;
  gameStatus: string | null;
};

export async function reResolveStaleCards(): Promise<{
  picksUpdated: number;
  cardsRescored: number;
  totalStale: number;
  logs: ReResolvePickLog[];
  skipped: ReResolveSkipLog[];
}> {
  const supabase = createAdminClient();

  // Find picks that need re-evaluation:
  // 1. Picks with null actual_value (not yet resolved with real stats)
  // 2. Pending picks on resolved cards (may have been missed during resolution)
  const selectFields = "id, card_id, selection, result, adjusted_line, prop_id, props(player_name, stat_category, line, game_id, games(external_event_id, sport, status, commence_time, home_team, away_team)), cards(status)";

  const [nullValueResult, pendingOnResolvedResult] = await Promise.all([
    (supabase.from("picks") as any)
      .select(selectFields)
      .is("actual_value", null)
      .in("result", ["hit", "miss", "dnp", "pending"]),
    (supabase.from("picks") as any)
      .select(selectFields)
      .eq("result", "pending")
      .eq("cards.status", "resolved"),
  ]);

  if (nullValueResult.error) {
    logError("resolution", "Failed to fetch stale picks", undefined, nullValueResult.error);
    return { picksUpdated: 0, cardsRescored: 0, totalStale: 0, logs: [], skipped: [] };
  }
  if (pendingOnResolvedResult.error) {
    logError("resolution", "Failed to fetch pending-on-resolved picks", undefined, pendingOnResolvedResult.error);
  }

  // Merge and dedupe by pick ID
  const pickMap = new Map<string, unknown>();
  for (const p of nullValueResult.data ?? []) pickMap.set(p.id, p);
  for (const p of pendingOnResolvedResult.data ?? []) pickMap.set(p.id, p);
  const stalePicks = Array.from(pickMap.values());

  if (stalePicks.length === 0) {
    return { picksUpdated: 0, cardsRescored: 0, totalStale: 0, logs: [], skipped: [] };
  }

  type StalePick = {
    id: string;
    card_id: string;
    selection: "over" | "under";
    result: string;
    adjusted_line: number | null;
    prop_id: string;
    props: {
      player_name: string;
      stat_category: StatCategory;
      line: number;
      game_id: string;
      games: {
        external_event_id: string | null;
        sport: string | null;
        status: string | null;
        commence_time: string | null;
        home_team: string | null;
        away_team: string | null;
      };
    };
    cards: { status: string } | null;
  };

  // Sport → date-based game fetchers (for re-matching games by team names).
  // La Liga also searches Copa del Rey as a fallback since props may be tagged
  // "la_liga" for Spanish cup games.
  const SPORT_FETCHERS: Record<string, Array<(date: string) => Promise<StatsGame[]>>> = {
    nba: [fetchNbaGamesByDate],
    epl: [fetchSoccerGamesByDate],
    la_liga: [fetchLaLigaGamesByDate, fetchCopaDelReyGamesByDate],
    copa_del_rey: [fetchCopaDelReyGamesByDate],
    ncaab: [fetchNcaabGamesByDate],
  };

  /** Try to find the correct ESPN event ID for a game by team-name matching. */
  async function rematchGame(
    sport: string,
    homeTeam: string,
    awayTeam: string,
    commenceTime: string | null,
  ): Promise<StatsGame | null> {
    const fetchers = SPORT_FETCHERS[sport];
    if (!fetchers) return null;
    const date = commenceTime ? new Date(commenceTime) : new Date();
    const dates = lookbackDatesForSport(sport, date);
    for (const fetcher of fetchers) {
      for (const d of dates) {
        try {
          const games = await fetcher(d);
          const match = games.find(
            (g) => teamsMatch(homeTeam, g.home_team) && teamsMatch(awayTeam, g.away_team),
          );
          if (match) return match;
        } catch (err) {
          logWarn("resolution", `Game rematch fetch failed for ${homeTeam} vs ${awayTeam}`, err);
          continue;
        }
      }
    }
    return null;
  }

  const allPicks = stalePicks as StalePick[];

  // Post-filter by 7-day recency to avoid unbounded re-evaluation of old DNP picks (B16/B17).
  // Include picks where commence_time is missing since we can't determine their age.
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const picks = allPicks.filter((pick) => {
    const ct = pick.props?.games?.commence_time;
    if (!ct) return true; // can't determine age — include
    return new Date(ct).getTime() >= recentCutoff;
  });

  // Cache boxscores per game to minimize API calls
  const boxscoreCache = new Map<string, PlayerBoxScore[]>();
  let picksUpdated = 0;
  const affectedCardIds = new Set<string>();
  const affectedUserIds = new Set<string>();
  const logs: ReResolvePickLog[] = [];
  const skipped: ReResolveSkipLog[] = [];

  const pickMeta = (pick: StalePick) => ({
    player: pick.props.player_name,
    stat: pick.props.stat_category,
    sport: pick.props?.games?.sport ?? null,
    gameStatus: pick.props?.games?.status ?? null,
  });

  const isOnResolvedCard = (pick: StalePick) => pick.cards?.status === "resolved";

  /** Void an unresolvable pick as push (only for picks on already-resolved cards). */
  async function voidAsPush(pick: StalePick): Promise<boolean> {
    if (!isOnResolvedCard(pick)) return false;
    const { error: updateErr } = await (supabase.from("picks") as any)
      .update({ result: "push", actual_value: null })
      .eq("id", pick.id);
    if (updateErr) {
      logError("resolution", `Failed to void pick ${pick.id} as push`, undefined, updateErr);
      return false;
    }
    picksUpdated++;
    affectedCardIds.add(pick.card_id);
    logs.push({
      player: pick.props.player_name,
      stat: pick.props.stat_category,
      line: pick.props.line,
      selection: pick.selection,
      oldResult: pick.result,
      newResult: "push",
      actualValue: null,
      sport: pick.props?.games?.sport ?? null,
      gameStatus: pick.props?.games?.status ?? null,
    });
    return true;
  }

  // Track games we've already re-matched so we don't re-fetch per pick
  const rematchedGames = new Map<string, string | null>(); // game_id → new event ID or null

  for (const pick of picks) {
    let eventId = pick.props?.games?.external_event_id;
    const gameDbId = pick.props.game_id;
    const sport = pick.props?.games?.sport ?? "nba";
    const homeTeam = pick.props?.games?.home_team;
    const awayTeam = pick.props?.games?.away_team;
    const ct = pick.props?.games?.commence_time;

    // DB commence_time is in the future — but the game may actually be done
    // (stale commence_time from odds API). Try to find the real game on ESPN
    // before giving up. If it's truly not started, skip it.
    if (ct && new Date(ct).getTime() > Date.now()) {
      if (pick.props?.games?.status === "final") {
        // Incorrect final status on a future game — fix it, but still
        // attempt rematch below in case the game actually happened.
        await (supabase.from("games") as any)
          .update({ status: "scheduled" })
          .eq("id", gameDbId);
      }
      // Try to find the game on ESPN — it might have actually been played
      if (homeTeam && awayTeam && !rematchedGames.has(gameDbId)) {
        const matched = await rematchGame(sport, homeTeam, awayTeam, ct);
        if (matched && matched.status === "final") {
          // Game actually happened — update DB and continue to resolve normally
          eventId = matched.game_id;
          rematchedGames.set(gameDbId, eventId);
          await (supabase.from("games") as any)
            .update({
              external_event_id: eventId,
              status: "final",
              home_score: matched.home_score,
              away_score: matched.away_score,
            })
            .eq("id", gameDbId);
          // Fall through to normal resolution below
        } else {
          rematchedGames.set(gameDbId, null);
          // Game not found on ESPN — if card is already resolved, void as push
          // to clear the dangling pending pick. Otherwise just skip.
          if (await voidAsPush(pick)) continue;
          skipped.push({ ...pickMeta(pick), reason: "Game hasn't started yet (future commence time)" });
          continue;
        }
      } else if (rematchedGames.has(gameDbId) && rematchedGames.get(gameDbId)) {
        eventId = rematchedGames.get(gameDbId)!;
        // Fall through — already rematched from a previous pick
      } else {
        // Already tried rematch for this game and failed
        if (await voidAsPush(pick)) continue;
        skipped.push({ ...pickMeta(pick), reason: "Game hasn't started yet (future commence time)" });
        continue;
      }
    }

    // If we already rematched this game from a previous pick, use the new event ID
    if (rematchedGames.has(gameDbId)) {
      eventId = rematchedGames.get(gameDbId) ?? eventId;
    }

    const gameStatus = pick.props?.games?.status;
    if (gameStatus !== "final") {
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      const gameStarted = ct ? new Date(ct).getTime() < sixHoursAgo : false;
      if (!(pick.result === "pending" && gameStarted)) {
        skipped.push({ ...pickMeta(pick), reason: `Game not final (${gameStatus ?? "unknown"})` });
        continue;
      }
    }

    // If no event ID, try to re-match the game by team names
    if (!eventId && homeTeam && awayTeam) {
      if (rematchedGames.has(gameDbId)) {
        eventId = rematchedGames.get(gameDbId) ?? null;
      } else {
        const matched = await rematchGame(sport, homeTeam, awayTeam, ct);
        if (matched) {
          eventId = matched.game_id;
          rematchedGames.set(gameDbId, eventId);
          // Update the game in DB with the new event ID and status
          await (supabase.from("games") as any)
            .update({
              external_event_id: eventId,
              status: matched.status === "post" ? "final" : matched.status,
              home_score: matched.home_score,
              away_score: matched.away_score,
            })
            .eq("id", gameDbId);
        } else {
          rematchedGames.set(gameDbId, null);
        }
      }
    }

    if (!eventId) {
      // If card is already resolved, void this dangling pick as push
      if (await voidAsPush(pick)) continue;
      skipped.push({ ...pickMeta(pick), reason: `No event ID and could not match ${homeTeam ?? "?"} vs ${awayTeam ?? "?"}` });
      continue;
    }

    let boxscore = boxscoreCache.get(eventId);
    if (!boxscore) {
      try {
        const fetcher = getBoxscoreFetcher(sport);
        boxscore = await fetcher(eventId);
        boxscoreCache.set(eventId, boxscore);
      } catch (err) {
        logWarn("resolution", `Boxscore fetch failed for event ${eventId}`, err);
        skipped.push({ ...pickMeta(pick), reason: "Boxscore fetch failed" });
        continue;
      }
    }

    // If boxscore returned data and the game wasn't marked final in the DB,
    // update the game status so sync-status and future runs work correctly.
    if (boxscore.length > 0 && gameStatus !== "final" && gameDbId) {
      await (supabase.from("games") as any)
        .update({ status: "final" })
        .eq("id", gameDbId);
    }

    let playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

    // Player not found — the event ID might be wrong (old API-Football ID).
    // Try to re-match the game by team names and fetch the correct boxscore.
    if (!playerStats && homeTeam && awayTeam && !rematchedGames.has(gameDbId)) {
      const matched = await rematchGame(sport, homeTeam, awayTeam, ct);
      if (matched && matched.game_id !== eventId) {
        const newEventId = matched.game_id;
        rematchedGames.set(gameDbId, newEventId);
        // Update DB with correct event ID
        await (supabase.from("games") as any)
          .update({
            external_event_id: newEventId,
            status: matched.status === "post" ? "final" : matched.status,
            home_score: matched.home_score,
            away_score: matched.away_score,
          })
          .eq("id", gameDbId);
        // Fetch boxscore with correct event ID
        try {
          const fetcher = getBoxscoreFetcher(sport);
          const newBoxscore = await fetcher(newEventId);
          boxscoreCache.set(newEventId, newBoxscore);
          playerStats = fuzzyMatchPlayer(newBoxscore, pick.props.player_name);
          boxscore = newBoxscore;
          eventId = newEventId;
        } catch (err) {
          logWarn("resolution", `Rematch boxscore fetch failed for ${pick.props.player_name}`, err);
        }
      }
    }

    if (!playerStats) {
      if (boxscore.length === 0) {
        skipped.push({ ...pickMeta(pick), reason: `Empty boxscore (event ${eventId})` });
        continue;
      }
      // Only treat absence as DNP once the game is confirmed final.
      // The 6-hour stale path (lines 372-380) can reach here for non-final
      // games — a bench player who hasn't entered a live game isn't DNP.
      if (gameStatus !== "final") {
        skipped.push({ ...pickMeta(pick), reason: `Player not in boxscore but game not final (${gameStatus ?? "unknown"})` });
        continue;
      }
      // Player absent from a non-empty boxscore = inactive (DNP)
      if (pick.result === "dnp") {
        skipped.push({ ...pickMeta(pick), reason: "Already DNP (no-op)" });
        continue;
      }
      logWarn("resolution", `Player "${pick.props.player_name}" not in boxscore for pick ${pick.id} (event ${eventId}), marking as DNP`);
      const { error: updateErr } = await (supabase.from("picks") as any)
        .update({ actual_value: null, result: "dnp" })
        .eq("id", pick.id);
      if (updateErr) {
        logError("resolution", `Failed to update pick ${pick.id} to dnp`, undefined, updateErr);
        continue;
      }
      logs.push({
        ...pickMeta(pick),
        line: pick.props.line,
        selection: pick.selection,
        oldResult: pick.result,
        newResult: "dnp",
        actualValue: null,
      });
      picksUpdated++;
      affectedCardIds.add(pick.card_id);
      continue;
    }

    // DNP handling
    if (playerStats.dnp) {
      if (pick.result === "dnp") {
        skipped.push({ ...pickMeta(pick), reason: "Already DNP (no-op)" });
        continue;
      }
      const { error: updateErr } = await (supabase.from("picks") as any)
        .update({ actual_value: null, result: "dnp" })
        .eq("id", pick.id);
      if (updateErr) {
        logError("resolution", `Failed to update pick ${pick.id} to dnp`, undefined, updateErr);
      }
      logs.push({
        ...pickMeta(pick),
        line: pick.props.line,
        selection: pick.selection,
        oldResult: pick.result,
        newResult: "dnp",
        actualValue: null,
      });
      picksUpdated++;
      affectedCardIds.add(pick.card_id);
      continue;
    }

    // Player has stats — evaluate or reclassify
    const actualValue = extractStatValue(playerStats, pick.props.stat_category);
    const effectiveLine = pick.adjusted_line ?? pick.props.line;

    let correctResult: PickResult;
    if (actualValue === effectiveLine) {
      correctResult = "push";
    } else if (
      (pick.selection === "over" && actualValue > effectiveLine) ||
      (pick.selection === "under" && actualValue < effectiveLine)
    ) {
      correctResult = "hit";
    } else {
      correctResult = "miss";
    }

    // Skip if already correct (no-op for non-pending picks)
    if (pick.result === correctResult) {
      skipped.push({ ...pickMeta(pick), reason: `Already correct (${correctResult})` });
      continue;
    }

    const { error: updateErr } = await (supabase.from("picks") as any)
      .update({ actual_value: actualValue, result: correctResult })
      .eq("id", pick.id);
    if (updateErr) {
      logError("resolution", `Failed to update pick ${pick.id}`, undefined, updateErr);
    }

    logs.push({
      ...pickMeta(pick),
      line: pick.props.line,
      selection: pick.selection,
      oldResult: pick.result,
      newResult: correctResult,
      actualValue,
    });
    picksUpdated++;
    affectedCardIds.add(pick.card_id);
  }

  // Re-score affected cards — update both score and total_picks
  let cardsRescored = 0;
  for (const cardId of affectedCardIds) {
    const { data: cardPicks, error: fetchErr } = await (supabase.from("picks") as any)
      .select("result, actual_value, notch, adjusted_line, selection, card_id, cards(user_id), props(line, stat_category)")
      .eq("card_id", cardId);

    if (fetchErr) {
      logError("resolution", `Failed to fetch picks for card ${cardId}`, undefined, fetchErr);
      continue;
    }
    if (!cardPicks) continue;

    type RescoredPick = {
      result: string;
      actual_value: number | null;
      notch: number | null;
      adjusted_line: number | null;
      selection: "over" | "under";
      cards: { user_id: string | null };
      props: { line: number; stat_category: string } | null;
    };
    const typedPicks = cardPicks as RescoredPick[];
    const newScore = typedPicks.filter((p) => p.result === "hit").length;
    const newTotal = typedPicks.filter((p) => p.result === "hit" || p.result === "miss").length;

    // Recompute card-level HeatScore from current pick results
    let newHeatScore: number | null = null;
    if (newTotal > 0) {
      try {
        const qualityResult = computeQualityBonus(
          typedPicks.map((p) => ({
            actualValue: p.actual_value,
            line: p.adjusted_line ?? p.props?.line ?? 0,
            selection: p.selection,
            result: p.result as PickResult,
            notchMultiplier: getNotchTier(p.notch ?? 0).multiplier,
          })),
        );
        newHeatScore = 0;
        for (let i = 0; i < typedPicks.length; i++) {
          const p = typedPicks[i];
          const notchMult = getNotchTier(p.notch ?? 0).multiplier;
          if (p.result === "hit") {
            newHeatScore += Math.round(HEATSCORE_HIT_BASE * notchMult) + qualityResult.perPick[i];
          } else if (p.result === "miss") {
            newHeatScore += qualityResult.perPick[i];
          }
        }
      } catch (err) {
        logWarn("resolution", `HeatScore recomputation failed for card ${cardId}`, err);
      }
    }

    const { error: cardErr } = await (supabase.from("cards") as any)
      .update({
        score: newScore,
        total_picks: newTotal,
        ...(newHeatScore !== null && { heat_score: newHeatScore }),
      })
      .eq("id", cardId);
    if (cardErr) {
      logError("resolution", `Failed to rescore card ${cardId}`, undefined, cardErr);
    }

    // Track affected users for leaderboard recalculation
    const userId = typedPicks[0]?.cards?.user_id;
    if (userId) affectedUserIds.add(userId);

    cardsRescored++;
  }

  // Recalculate leaderboard for each affected user (B3)
  for (const userId of affectedUserIds) {
    try {
      await recalculateLeaderboard(supabase, userId);
    } catch (err) {
      logError("resolution", `Failed to recalculate leaderboard for user ${userId}`, undefined, err);
    }
  }

  return { picksUpdated, cardsRescored, totalStale: picks.length, logs, skipped };
}

export async function resolveCard(
  card: Card & { picks: PickWithProp[] },
  boxscoreCache: Map<string, PlayerBoxScore[]>
): Promise<ResolutionResult | null> {
  const pickResolutions: PickResolution[] = [];

  for (const pick of card.picks) {
    const eventId = pick.props?.games?.external_event_id;
    if (!eventId) {
      // Can't resolve without external event ID — mark as push (void)
      // since we genuinely can't verify the outcome
      pickResolutions.push(buildPickResolution(pick, { result: "push", actual_value: null }));
      continue;
    }

    // Fetch boxscore (with cache) — use sport-aware endpoint
    let boxscore = boxscoreCache.get(eventId);
    if (!boxscore) {
      try {
        const fetcher = getBoxscoreFetcher(pick.props?.games?.sport);
        boxscore = await fetcher(eventId);
        boxscoreCache.set(eventId, boxscore);
      } catch (err) {
        logWarn("resolution", `Boxscore fetch failed for event ${eventId} during resolve`, err);
        // Apply the same 48h safety valve as player-not-found. If the boxscore
        // endpoint is permanently broken for this event, void all remaining picks
        // as push so the card doesn't stay locked forever.
        const gameTime = pick.props?.games?.commence_time;
        const hrsAgo = gameTime
          ? (Date.now() - new Date(gameTime).getTime()) / (1000 * 60 * 60)
          : null;

        if (hrsAgo !== null && hrsAgo > 48) {
          logWarn("resolution", `Boxscore fetch failed after ${Math.round(hrsAgo)}h for event ${eventId}, voiding remaining picks on card ${card.id}`);
          for (const remainingPick of card.picks.slice(card.picks.indexOf(pick))) {
            pickResolutions.push(buildPickResolution(remainingPick, { result: "push", actual_value: null }));
          }
          break; // exit pick loop, resolve the card with what we have
        }

        logWarn("resolution", `Boxscore fetch failed for event ${eventId}, retrying card ${card.id}`);
        return null;
      }
    }

    // Empty boxscore = data not available yet (distinct from player not found
    // in a populated boxscore). Use a shorter timeout for soccer since
    // API-Football typically syncs within 1 hour.
    if (boxscore.length === 0) {
      const gameTime = pick.props?.games?.commence_time;
      const hrsAgo = gameTime
        ? (Date.now() - new Date(gameTime).getTime()) / (1000 * 60 * 60)
        : null;
      const sport = pick.props?.games?.sport ?? "nba";
      const maxWaitHrs = isSoccer(sport) ? 6 : 48;

      if (hrsAgo !== null && hrsAgo > maxWaitHrs) {
        logWarn("resolution", `Empty boxscore after ${Math.round(hrsAgo)}h for event ${eventId} (${sport}), voiding picks for this event on card ${card.id}`);
        for (const remainingPick of card.picks) {
          const rEventId = remainingPick.props?.games?.external_event_id;
          if (rEventId !== eventId) continue;
          pickResolutions.push(buildPickResolution(remainingPick, { result: "push", actual_value: null }));
        }
        continue;
      }

      logWarn("resolution", `Empty boxscore for event ${eventId} (${sport}, ${Math.round(hrsAgo ?? 0)}h ago), retrying card ${card.id}`);
      return null;
    }

    const playerStats = fuzzyMatchPlayer(boxscore, pick.props.player_name);

    if (!playerStats) {
      const gameStatus = pick.props?.games?.status;
      if (gameStatus !== "final") {
        // Callers gate on all-final, but guard defensively in case
        // resolveCard is ever invoked on a non-final game.
        return null;
      }
      // Player absent from a non-empty final boxscore means they were
      // inactive (injury, rest, etc.) — ESPN omits them entirely from the
      // game-day roster. Treat as DNP (voided pick). fuzzyMatchPlayer covers
      // exact, last-name, and substring matches, so a miss here is definitive
      // rather than a name-normalization gap.
      logWarn("resolution", `Player "${pick.props.player_name}" not in boxscore for card ${card.id} (event ${eventId}), marking as DNP`);
      pickResolutions.push(buildPickResolution(pick, { result: "dnp", actual_value: null }));
      continue;
    }

    // DNP detection — player is on the roster but didn't play
    if (playerStats.dnp) {
      pickResolutions.push(buildPickResolution(pick, { result: "dnp", actual_value: null }));
      continue;
    }

    const actualValue = extractStatValue(
      playerStats,
      pick.props.stat_category
    );
    let result: PickResult;

    // Use the adjusted line (notch-shifted) if set, otherwise the original prop line.
    // Existing picks with adjusted_line=NULL resolve against the original line.
    const effectiveLine = pick.adjusted_line ?? pick.props.line;

    if (actualValue === effectiveLine) {
      // Push: actual value exactly equals the line. With notch-shifted lines
      // landing on whole numbers, pushes are now possible. Treated as a void.
      result = "push";
    } else if (
      (pick.selection === "over" && actualValue > effectiveLine) ||
      (pick.selection === "under" && actualValue < effectiveLine)
    ) {
      result = "hit";
    } else {
      result = "miss";
    }

    pickResolutions.push(buildPickResolution(pick, {
      result,
      actual_value: actualValue,
      line: effectiveLine,
    }));
  }

  const score = pickResolutions.filter((p) => p.result === "hit").length;
  const misses = pickResolutions.filter((p) => p.result === "miss").length;
  const scoredTotal = score + misses;

  // Compute HeatScore multiplier + Flame Token payout.
  // Wrapped defensively so a computation error never blocks card resolution.
  let heatScoreInt: number | null = 0;
  let qualityBonus = 0;
  const wager = card.fire_token_wager as number | null;
  let payout: number | null = wager != null ? 0 : null;

  try {
    // Quality bonus (shared by both scoring systems)
    const qualityResult = computeQualityBonus(
      pickResolutions.map((p) => ({
        actualValue: p.actual_value,
        line: p.line,
        selection: p.selection,
        result: p.result,
        notchMultiplier: getNotchTier(p.notch ?? 0).multiplier,
      })),
    );
    qualityBonus = qualityResult.total;

    // HeatScore — per-pick additive (for challenges + display).
    // No multiplier table, no bust. Each pick earns/loses based on
    // hit/miss × notch difficulty + quality margin.
    // Stamp per-pick heat_score for persistence.
    for (let i = 0; i < pickResolutions.length; i++) {
      const p = pickResolutions[i];
      const notchMult = getNotchTier(p.notch ?? 0).multiplier;
      const qt = qualityResult.perPick[i];
      if (p.result === "hit") {
        p.heat_score = Math.round(HEATSCORE_HIT_BASE * notchMult) + qt;
      } else if (p.result === "miss") {
        p.heat_score = qt; // quality penalty only
      }
      // DNP/push stays 0
    }
    if (scoredTotal > 0) {
      heatScoreInt = pickResolutions.reduce((sum, p) => sum + p.heat_score, 0);
    }

    // Wager Flame payout — uses multiplier table (separate system)
    if (wager != null) {
      const hsResult = computeCardHeatScore(score, misses, card.card_size);
      payout = computeFireTokenPayout(wager, hsResult.multiplier, qualityBonus);
    }
  } catch (hsError) {
    logError("resolution", "HeatScore computation failed, resolving without HS", undefined, hsError);
  }

  return {
    card_id: card.id,
    user_id: card.user_id,
    challenge_id: card.challenge_id ?? null,
    score,
    total: scoredTotal,
    picks: pickResolutions,
    heat_score: heatScoreInt,
    fire_token_wager: wager,
    fire_token_payout: payout,
    quality_bonus: qualityBonus,
  };
}

export async function persistResolution(
  supabase: ReturnType<typeof createAdminClient>,
  result: ResolutionResult
): Promise<boolean> {
  // Try atomic RPC first (single transaction for all picks + card status)
   
  const { data: success, error } = await (supabase.rpc as any)("resolve_card", {
    p_card_id: result.card_id,
    p_score: result.score,
    p_total: result.total,
    p_picks: result.picks.map((p) => ({
      pick_id: p.pick_id,
      result: p.result,
      actual_value: p.actual_value,
      heat_score: p.heat_score,
    })),
    p_heat_score: result.heat_score,
    p_fire_token_payout: result.fire_token_payout,
  });

  if (!error && success) {
    // RPC succeeded — update leaderboard stats + fire token balance.
    // Stats update requires scoreable picks (total > 0). Token balance
    // update runs even for all-DNP cards so the wager is credited back.
    const hasScoreablePicks = result.total > 0;
    const hasTokenWager = result.fire_token_wager != null;
    if (result.user_id && (hasScoreablePicks || hasTokenWager)) {
      await updateLeaderboardStats(
        supabase, result.user_id, result.score, result.total,
        result.fire_token_wager, result.fire_token_payout,
      );
    }
    return true;
  }

  // Already resolved by another caller — no-op
  if (!error && !success) return false;
  if (error?.message?.includes("not found") || error?.message?.includes("locked")) {
    return false;
  }

  // RPC failed for another reason — fall back to direct writes
  logError("resolution", "resolve_card RPC failed, falling back to direct writes", undefined, error);

  // Verify card is still locked
  const { data: check } = await (supabase.from("cards") as any)
    .select("status")
    .eq("id", result.card_id)
    .single();
  if (check?.status !== "locked") return false;

  // Write pick results
  for (const p of result.picks) {
    const { error: pickError } = await (supabase.from("picks") as any)
      .update({ result: p.result, actual_value: p.actual_value, heat_score: p.heat_score })
      .eq("id", p.pick_id);
    if (pickError) {
      logError("resolution", `Failed to write pick ${p.pick_id}`, undefined, pickError);
    }
  }

  // Mark card resolved (only if still locked — race protection)
  const { data: updated } = await (supabase.from("cards") as any)
    .update({
      status: "resolved",
      score: result.score,
      total_picks: result.total,
      heat_score: result.heat_score,
      fire_token_payout: result.fire_token_payout,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", result.card_id)
    .eq("status", "locked")
    .select("id");

  if (!updated?.length) return false;

  // Update leaderboard stats + fire token balance
  const hasScoreablePicks = result.total > 0;
  const hasTokenWager = result.fire_token_wager != null;
  if (result.user_id && (hasScoreablePicks || hasTokenWager)) {
    await updateLeaderboardStats(
      supabase, result.user_id, result.score, result.total,
      result.fire_token_wager, result.fire_token_payout,
    );
  }

  return true;
}

/**
 * Post-resolution side effects: notification + achievement check.
 * Shared by resolveEligibleCards and tryResolveFromLiveData.
 */
export async function handlePostResolution(
  supabase: ReturnType<typeof createAdminClient>,
  result: ResolutionResult,
): Promise<void> {
  if (!result.user_id) return;

  // Fetch profile with notification preferences (used by both notification + email)
  let profile: { email: string | null; username: string | null; notification_preferences: NotificationPreferences | null } | null = null;
  try {
    const { data } = await (supabase.from("profiles") as any)
      .select("email, username, notification_preferences")
      .eq("id", result.user_id)
      .single();
    profile = data;
  } catch (profileError) {
    logError("card-resolution", "Failed to fetch profile for notification/email", undefined, profileError);
  }

  try {
    const { title, body } = getCardNotificationMessage(result.score, result.total);
    await createNotification(supabase, {
      user_id: result.user_id,
      type: "card_resolved",
      title,
      body,
      metadata: { card_id: result.card_id },
    }, profile?.notification_preferences);
  } catch (notifError) {
    logError("card-resolution", "Failed to create card_resolved notification", undefined, notifError);
  }

  // Send card-resolved email (fire-and-forget, never blocks resolution).
  // Skip if this card belongs to a challenge — challenge_resolved email handles that.
  // Transactional sends do NOT pass unsubscribeUrl — see friend route for rationale.
  if (!result.challenge_id) {
    try {
      if (profile?.email && shouldSendEmail("card_resolved", profile.notification_preferences)) {
        const { subject, react, text } = getCardResolvedEmailProps({
          username: profile.username ?? "Player",
          score: result.score,
          total: result.total,
          cardId: result.card_id,
        });
        void sendEmail({ to: profile.email, subject, react, text });
      }
    } catch (emailError) {
      logError("card-resolution", "Failed to send card_resolved email", undefined, emailError);
    }
  }

  try {
    const lbResult = await (supabase.from("leaderboard_entries") as any)
      .select("total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses")
      .eq("user_id", result.user_id)
      .single();

    const lb = (lbResult.data ?? DEFAULT_LEADERBOARD_STATS) as {
      total_cards: number;
      current_streak: number;
      best_streak: number;
      win_rate: number;
      h2h_wins: number;
      h2h_losses: number;
    };

    await checkAndUnlockAchievements(supabase, result.user_id, {
      cardResolved: { score: result.score, total: result.total },
      leaderboardStats: lb,
    });
  } catch (achievementError) {
    logError("card-resolution", "Failed to check achievements after card resolution", undefined, achievementError);
  }

  // For group-challenge cards: once any card resolves, late joiners would
  // have unfair information. Boot anyone who hasn't locked in yet.
  // This is fire-and-forget — failure to boot doesn't undo the resolution.
  if (result.challenge_id) {
    try {
      await bootNonActiveParticipantsAfterResolution(supabase, result.challenge_id);
    } catch (bootError) {
      logError(
        "card-resolution",
        "Failed to boot non-active participants after challenge card resolution",
        undefined,
        bootError,
      );
    }
  }
}

function getCardNotificationMessage(
  score: number,
  total: number
): { title: string; body: string } {
  const { headline, subtext } = getCardTier(score, total);
  return {
    title: headline,
    body: `${score === 0 ? "0" : score} ${score === total ? `for ${total}` : `out of ${total} hits`}. ${subtext}`,
  };
}

/**
 * Recalculates leaderboard stats from scratch for a given user.
 * Used by reResolveStaleCards when picks are reclassified.
 *
 * NOTE: This does NOT recalculate current_streak or best_streak — those depend
 * on chronological card resolution order which is expensive to reconstruct.
 * Streaks are a known limitation and will be addressed in a follow-up.
 */
async function recalculateLeaderboard(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<void> {
  // Fetch all resolved cards with scoreable picks (total_picks > 0)
  const { data: cards, error } = await (supabase.from("cards") as any)
    .select("score, total_picks")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .gt("total_picks", 0)
    .limit(10000);

  if (error) {
    logError("resolution", `recalculateLeaderboard: failed to fetch cards for user ${userId}`, undefined, error);
    return;
  }
  if (!cards) return;

  const typedCards = cards as { score: number; total_picks: number }[];

  if (typedCards.length >= 10000) {
    logWarn("resolution", `recalculateLeaderboard: hit 10000-row cap for user ${userId} — stats may be truncated`);
  }

  const totalCards = typedCards.length;
  const totalCorrectPicks = typedCards.reduce((sum, c) => sum + c.score, 0);
  const totalAttemptedPicks = typedCards.reduce((sum, c) => sum + c.total_picks, 0);
  const winRate =
    totalAttemptedPicks > 0
      ? Math.round((totalCorrectPicks / totalAttemptedPicks) * 100 * 100) / 100
      : 0;

  // Try update first; if no rows matched, insert a new entry.
  // Preserves h2h stats and streaks (not recalculated here).
  const { data: updated, error: updateErr } = await (supabase.from("leaderboard_entries") as any)
    .update({
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("user_id");

  if (updateErr) {
    logError("resolution", `recalculateLeaderboard: update failed for user ${userId}`, undefined, updateErr);
    return;
  }

  // If no rows were updated, insert a new entry
  if (!updated || updated.length === 0) {
    const { error: insertErr } = await (supabase.from("leaderboard_entries") as any).insert({
      user_id: userId,
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      current_streak: 0,
      best_streak: 0,
      h2h_wins: 0,
      h2h_losses: 0,
    });
    if (insertErr) {
      logError("resolution", `recalculateLeaderboard: insert failed for user ${userId}`, undefined, insertErr);
    }
  }
}

/**
 * Updates leaderboard_entries for a user after card resolution.
 * Increments total_cards, adds hits to total_correct_picks, tracks
 * total_attempted_picks, recalculates win_rate, and updates
 * current_streak / best_streak.
 *
 * NOTE: This uses read-modify-write without row-level locking. In theory,
 * two concurrent resolutions for the same user could lose an update. In
 * practice, cards resolve sequentially per user in the cron job. If this
 * becomes an issue, move to a Postgres RPC with atomic increments.
 *
 * A "winning" card requires >= 66% correct picks:
 *   threshold = Math.ceil(totalPicks * 0.66)
 *   2 picks -> need 2, 3 -> 2, 4 -> 3, 5 -> 4, 6 -> 4
 */
async function updateLeaderboardStats(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  score: number,
  totalPicks: number,
  fireTokenWager?: number | null,
  fireTokenPayout?: number | null,
): Promise<void> {
  const winThreshold = Math.ceil(totalPicks * 0.66);
  const isWin = totalPicks > 0 && score >= winThreshold;

  // Fetch existing entry
  const existingResult = await (supabase.from("leaderboard_entries") as any)
    .select(
      "total_cards, total_correct_picks, total_attempted_picks, current_streak, best_streak, h2h_wins, h2h_losses, fire_tokens_balance, fire_tokens_lifetime"
    )
    .eq("user_id", userId)
    .single();

  if (existingResult.error) {
    if (existingResult.error.code === "PGRST116") {
      // No existing leaderboard row — new user, will be created below
    } else {
      logError("resolution", `updateLeaderboardStats: failed to fetch entry for user ${userId}`, undefined, existingResult.error);
    }
  }

  const existing = existingResult.data as {
    total_cards: number;
    total_correct_picks: number;
    total_attempted_picks: number;
    current_streak: number;
    best_streak: number;
    h2h_wins: number;
    h2h_losses: number;
    fire_tokens_balance: number;
    fire_tokens_lifetime: number;
  } | null;

  const totalCards = (existing?.total_cards ?? 0) + 1;
  const totalCorrectPicks = (existing?.total_correct_picks ?? 0) + score;
  const totalAttemptedPicks =
    (existing?.total_attempted_picks ?? 0) + totalPicks;
  const winRate =
    totalAttemptedPicks > 0
      ? Math.round((totalCorrectPicks / totalAttemptedPicks) * 100 * 100) / 100
      : 0;

  const currentStreak = isWin ? (existing?.current_streak ?? 0) + 1 : 0;
  const previousBest = existing?.best_streak ?? 0;
  const bestStreak = Math.max(previousBest, currentStreak);

  // Flame Token balance updates (only when a wager was placed).
  // The wager was already deducted at card creation time, so the delta
  // here is just the payout (which is 0 on bust). Lifetime tracks gross payouts.
  // Token credit uses atomic RPC to prevent lost writes from concurrent operations.
  const hasTokenWager = fireTokenWager != null && fireTokenPayout != null;

  if (hasTokenWager && fireTokenPayout > 0) {
    const { error: creditErr } = await (supabase.rpc as any)(
      "credit_fire_tokens",
      { p_user_id: userId, p_amount: fireTokenPayout, p_include_lifetime: true },
    );
    if (creditErr) {
      logError("resolution", `Failed to credit fire tokens for user ${userId}`, undefined, creditErr);
    }
  }

  if (existing) {
    // Update existing entry -- preserve h2h stats
    const { error: updateErr } = await (supabase.from("leaderboard_entries") as any)
      .update({
        total_cards: totalCards,
        total_correct_picks: totalCorrectPicks,
        total_attempted_picks: totalAttemptedPicks,
        win_rate: winRate,
        current_streak: currentStreak,
        best_streak: bestStreak,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (updateErr) {
      logError("resolution", `updateLeaderboardStats: update failed for user ${userId}`, undefined, updateErr);
    }
  } else {
    // Create new entry via insert (preserves default h2h values)
    const { error: insertErr } = await (supabase.from("leaderboard_entries") as any).insert({
      user_id: userId,
      total_cards: totalCards,
      total_correct_picks: totalCorrectPicks,
      total_attempted_picks: totalAttemptedPicks,
      win_rate: winRate,
      current_streak: currentStreak,
      best_streak: bestStreak,
      h2h_wins: 0,
      h2h_losses: 0,
    });
    if (insertErr) {
      logError("resolution", `updateLeaderboardStats: insert failed for user ${userId}`, undefined, insertErr);
    }
  }
}

/**
 * Resolve cards instantly using data already fetched by the live endpoint.
 * No extra ESPN API calls — reuses the pre-fetched boxscores.
 *
 * Called from the live polling endpoints so cards resolve within ~30s
 * of the last game ending (the next poll cycle).
 */
export async function tryResolveFromLiveData(
  cards: Array<{ id: string; status: string; picks: PickWithPropAndGame[] }>,
  gameStatusMap: Map<string, StatsGame>,
  boxscoreMap: Map<string, PlayerBoxScore[]>,
): Promise<ResolutionResult[]> {
  // Step 1: Find locked cards where ALL picks' games are final in live data
  const eligibleCardIds: string[] = [];
  const gameUpdates = new Map<string, StatsGame>();

  for (const card of cards) {
    if (card.status !== "locked") continue;

    const allFinal = card.picks.every((pick) => {
      // Safety: never treat a future game as final
      if (!hasGameStarted(pick.props?.games?.commence_time)) return false;
      const eventId = pick.props?.games?.external_event_id;
      if (eventId) {
        const liveGame = gameStatusMap.get(eventId);
        if (liveGame) return liveGame.status === "final";
      }
      // Game not in today's live data or has no event ID — trust DB status.
      return pick.props?.games?.status === "final";
    });

    if (!allFinal) continue;
    eligibleCardIds.push(card.id);

    // Collect game rows to update (deduped by DB game_id)
    for (const pick of card.picks) {
      const eventId = pick.props?.games?.external_event_id;
      if (!eventId) continue;
      const liveGame = gameStatusMap.get(eventId);
      if (liveGame && !gameUpdates.has(pick.props.game_id)) {
        gameUpdates.set(pick.props.game_id, liveGame);
      }
    }
  }

  if (eligibleCardIds.length === 0) return [];

  const supabase = createAdminClient();

  // Step 2: Update DB game rows with final status and scores
  for (const [dbGameId, liveGame] of gameUpdates) {
    const { error: gameErr } = await (supabase.from("games") as any)
      .update({
        status: "final",
        external_event_id: liveGame.game_id,
        home_score: liveGame.home_score,
        away_score: liveGame.away_score,
      })
      .eq("id", dbGameId);
    if (gameErr) {
      logError("resolution", `Failed to update game ${dbGameId}`, undefined, gameErr);
    }
  }

  // Step 3: Fetch full card data from DB (need user_id, prop_id, etc.)
  const cardsResult = await (supabase.from("cards") as any)
    .select("*, picks(*, props(*, games(*)))")
    .in("id", eligibleCardIds)
    .eq("status", "locked");

  if (cardsResult.error || !cardsResult.data) return [];

  const fullCards = cardsResult.data as (Card & { picks: PickWithProp[] })[];
  const results: ResolutionResult[] = [];

  // Step 4: Resolve each card, reusing pre-fetched boxscore data
  for (const card of fullCards) {
    const result = await resolveCard(card, boxscoreMap);
    if (!result) continue;

    const resolved = await persistResolution(supabase, result);
    if (!resolved) continue; // Already resolved by another caller

    if (result.total > 0) {
      await handlePostResolution(supabase, result);
    } else if (result.user_id) {
      await createNotification(supabase, {
        user_id: result.user_id,
        type: "card_resolved",
        title: "No Contest",
        body: "Your card resolved with no scoreable picks.",
        metadata: { card_id: result.card_id },
      }, null).catch((err) => { logWarn("resolution", "Failed to send no-contest notification", err); });
    }
    results.push(result);
  }

  // Step 5: Resolve eligible challenges if any cards were resolved
  if (results.length > 0) {
    try {
      await resolveEligibleChallenges();
    } catch (err) {
      logError("resolution", "Failed to resolve challenges", undefined, err);
    }
  }

  // Step 6: Re-resolve stale cards as cleanup (only if we just resolved something)
  if (results.length > 0) {
    try {
      await reResolveStaleCards();
    } catch (err) {
      logError("resolution", "Failed to re-resolve stale cards", undefined, err);
    }
  }

  return results;
}
