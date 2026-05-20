/**
 * Daily Recap Computation Engine
 *
 * Aggregates all resolved picks for a given date into structured callout data
 * (trap props, lock props, player spotlights, perfect cards, etc.) and
 * per-user personal highlights. Results are stored in the `recaps` table.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { catLabel } from "@/lib/constants";
import type {
  StatCategory,
  PickSelection,
  NotificationPreferences,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TrapOrLockProp {
  propId: string;
  playerName: string;
  statCategory: StatCategory;
  line: number;
  hitRate: number;
  pickCount: number;
  playerId: string | null;
  team: string | null;
  sport: string;
}

export interface PlayerSpotlight {
  playerName: string;
  hitRate: number;
  pickCount: number;
  sport: string;
  playerId: string | null;
  team: string | null;
}

export interface MostPickedPlayer {
  playerName: string;
  pickCount: number;
  hitRate: number;
  playerId: string | null;
  team: string | null;
  sport: string;
}

export interface MostPickedProp {
  propId: string;
  playerName: string;
  statCategory: StatCategory;
  line: number;
  selectionBreakdown: { over: number; under: number };
  pickCount: number;
  hitRate: number;
  playerId: string | null;
  team: string | null;
  sport: string;
}

export interface PerfectCardEntry {
  userId: string;
  username: string;
  cardId: string;
  score: number;
  totalPicks: number;
}

export interface PerfectCards {
  count: number;
  userIds: string[];
  usernames: string[];
  entries?: PerfectCardEntry[];
}

export interface BreakdownEntry {
  key: string;
  hitRate: number;
  pickCount: number;
}

export interface ConsensusPick {
  propId: string;
  playerName: string;
  statCategory: StatCategory;
  line: number;
  pickCount: number;
  dominantSide: "over" | "under";
  dominantPct: number;
  wasCorrect: boolean;
  sport: string;
}

export type SpotlightType =
  | "player_trap"      // player who fooled pickers
  | "player_lock"      // player everyone got right
  | "prop_unanimous"   // everyone picked the same side
  | "category_hot"     // stat category with extreme hit rate
  | "category_cold"    // stat category that burned everyone
  | "team_hot"         // team with high hit rate
  | "team_cold"        // team that burned pickers
  | "over_under_skew"  // heavy lean to one side
  | "perfect_cards"    // perfect card count
  | "consensus_upset"  // crowd agreed but was wrong
  | "most_picked"      // most picked player or prop
  | "sport_hot"        // sport with high hit rate
  | "sport_cold"       // sport that burned pickers

export interface Spotlight {
  type: SpotlightType;
  sentiment: "positive" | "negative" | "neutral";
  headline: string;
  detail: string;
  value: number;         // the key number (percentage, count)
  valueSuffix: string;   // "%", " picks", "x", etc.
  subject?: string;      // player name, team name, category, etc.
  sport?: string;        // sport key for player/team spotlights
  playerId?: string;     // player external ID for headshot rendering
  team?: string;         // team name
  propId?: string;       // prop ID for prop-level spotlights (unanimous, consensus)
  statCategory?: string; // stat category for prop-level spotlights
}

export interface RecapData {
  trapProps: TrapOrLockProp[];
  lockProps: TrapOrLockProp[];
  playerSpotlightsGood: PlayerSpotlight[];
  playerSpotlightsBad: PlayerSpotlight[];
  mostPickedPlayers: MostPickedPlayer[];
  mostPickedProps: MostPickedProp[];
  perfectCards: PerfectCards;
  statCategoryBreakdown: BreakdownEntry[];
  sportBreakdown: BreakdownEntry[];
  teamBreakdown: BreakdownEntry[];
  consensusPicks: ConsensusPick[];
  spotlights: Spotlight[];
  platformHitRate: number;
  totalPicks: number;
  totalCards: number;
  overCount: number;
  underCount: number;
}

export interface PickHighlight {
  playerName: string;
  statCategory: StatCategory;
  line: number;
  selection: PickSelection;
  actualValue: number | null;
  margin: number;
}

export interface PersonalHighlight {
  cardsPlayed: number;
  hitRate: number;
  bestPick: PickHighlight | null;
  worstPick: PickHighlight | null;
  platformAvgHitRate: number;
  featuredIn: string[];
}

// ---------------------------------------------------------------------------
// Weekly recap types
// ---------------------------------------------------------------------------

export interface WeeklyTrendPoint {
  date: string; // YYYY-MM-DD
  hitRate: number; // 0-1
  totalPicks: number;
  totalCards: number;
}

export interface WagerHighlights {
  biggestPayout: { username: string; wager: number; payout: number; multiplier: number; cardId: string } | null;
  biggestBust: { username: string; wager: number; cardId: string } | null;
  topWagerer: { username: string; totalWagered: number; netResult: number } | null;
  totalWagered: number;
  totalPayouts: number;
}

export interface WeeklyRecapData {
  /** 7-day trend: one entry per day, ordered oldest to newest */
  dailyTrend: WeeklyTrendPoint[];
  /** Aggregated platform hit rate for the week */
  weeklyHitRate: number;
  /** Total picks across all 7 days */
  totalPicks: number;
  /** Total cards across all 7 days */
  totalCards: number;
  /** Most picked player across the week (min `weeklyTopMin` picks) */
  topPlayer: {
    playerName: string;
    hitRate: number;
    pickCount: number;
    sport: string;
  } | null;
  /** Prop with lowest hit rate across the week (min 10 picks) -- worst trap */
  worstTrap: TrapOrLockProp | null;
  /** Best lock prop of the week */
  bestLock: TrapOrLockProp | null;
  /** Date range: start date string */
  startDate: string;
  /** Date range: end date string */
  endDate: string;
  /** Full RecapData aggregated across the week, for tile grid rendering */
  recapData: RecapData | null;
  /** Flame Coin wager highlights for the week */
  wagerHighlights: WagerHighlights | null;
}

export interface WeeklyPersonalStats {
  weeklyHitRate: number;
  totalCards: number;
  platformWeeklyHitRate: number;
  dailyTrend: { date: string; hitRate: number; cards: number }[];
}

// ---------------------------------------------------------------------------
// Internal row shapes for the joined query
// ---------------------------------------------------------------------------

interface ResolvedPickRow {
  id: string;
  card_id: string;
  prop_id: string;
  selection: PickSelection;
  result: "hit" | "miss";
  actual_value: number | null;
  props: {
    id: string;
    player_id: string | null;
    player_name: string;
    player_team: string | null;
    stat_category: StatCategory;
    line: number;
    games: { sport: string } | null;
  } | null;
}

interface ResolvedCardRow {
  id: string;
  user_id: string | null;
  score: number;
  total_picks: number;
  picks: ResolvedPickRow[];
}

// ---------------------------------------------------------------------------
// Shared aggregation helper
// ---------------------------------------------------------------------------

/**
 * Core aggregation logic: given flattened picks and cards, compute all
 * RecapData fields (trap/lock props, spotlights, breakdowns, etc.).
 */
async function buildRecapData(
  allPicks: ResolvedPickRow[],
  cards: ResolvedCardRow[],
  supabase: ReturnType<typeof createAdminClient>,
): Promise<RecapData> {
  // Platform-level hit rate
  const totalHits = allPicks.filter((p) => p.result === "hit").length;
  const totalPicks = allPicks.length;
  const platformHitRate = totalPicks > 0 ? totalHits / totalPicks : 0;

  // Group picks by prop_id
  const byProp = groupBy(allPicks, (p) => p.prop_id);

  // Group picks by player name
  const byPlayer = groupBy(allPicks, (p) => p.props?.player_name ?? "Unknown");

  // Group picks by stat category
  const byCategory = groupBy(
    allPicks,
    (p) => p.props?.stat_category ?? "unknown"
  );

  // Group picks by sport
  const bySport = groupBy(
    allPicks,
    (p) => p.props?.games?.sport ?? "unknown"
  );

  // --- Adaptive thresholds (with higher absolute minimums for small datasets) ---
  const trapLockMin = Math.max(3, Math.floor(totalPicks / 20));
  const spotlightMin = Math.max(3, Math.floor(totalPicks / 25));

  // Track featured players to limit cross-tile repetition.
  // Each player can appear in at most 2 tiles.
  const playerTileCount = new Map<string, number>();
  const canFeature = (name: string) => (playerTileCount.get(name) ?? 0) < 2;
  const markFeatured = (name: string) =>
    playerTileCount.set(name, (playerTileCount.get(name) ?? 0) + 1);

  // --- Trap Props (hit rate < 0.30) ---
  const trapProps: TrapOrLockProp[] = [];
  const lockProps: TrapOrLockProp[] = [];

  for (const [propId, picks] of Object.entries(byProp)) {
    if (picks.length < trapLockMin) continue;
    const hits = picks.filter((p) => p.result === "hit").length;
    const rate = hits / picks.length;
    const representative = picks[0];
    const entry: TrapOrLockProp = {
      propId,
      playerName: representative.props?.player_name ?? "Unknown",
      statCategory: representative.props?.stat_category ?? "points",
      line: representative.props?.line ?? 0,
      hitRate: round(rate, 3),
      pickCount: picks.length,
      playerId: representative.props?.player_id ?? null,
      team: representative.props?.player_team ?? null,
      sport: representative.props?.games?.sport ?? "unknown",
    };
    if (rate < 0.3) trapProps.push(entry);
    if (rate > 0.75) lockProps.push(entry);
  }

  // Sort trap by lowest hit rate, lock by highest
  trapProps.sort((a, b) => a.hitRate - b.hitRate);
  lockProps.sort((a, b) => b.hitRate - a.hitRate);

  // Dedup trap/lock: skip players already at the 2-tile limit, cap at 5 each
  for (const arr of [trapProps, lockProps]) {
    const keep: TrapOrLockProp[] = [];
    for (const entry of [...arr]) {
      if (keep.length >= 5) break;
      if (!canFeature(entry.playerName)) continue;
      keep.push(entry);
      markFeatured(entry.playerName);
    }
    arr.length = 0;
    arr.push(...keep);
  }

  // --- Player Spotlights ---
  const playerSpotlightsGood: PlayerSpotlight[] = [];
  const playerSpotlightsBad: PlayerSpotlight[] = [];

  for (const [playerName, picks] of Object.entries(byPlayer)) {
    if (picks.length < spotlightMin) continue;
    const hits = picks.filter((p) => p.result === "hit").length;
    const rate = hits / picks.length;
    const sport = picks[0].props?.games?.sport ?? "unknown";
    const entry: PlayerSpotlight = {
      playerName,
      hitRate: round(rate, 3),
      pickCount: picks.length,
      sport,
      playerId: picks[0].props?.player_id ?? null,
      team: picks[0].props?.player_team ?? null,
    };
    if (rate > 0.8) playerSpotlightsGood.push(entry);
    if (rate < 0.25) playerSpotlightsBad.push(entry);
  }

  playerSpotlightsGood.sort((a, b) => b.hitRate - a.hitRate);
  playerSpotlightsBad.sort((a, b) => a.hitRate - b.hitRate);

  // Dedup spotlights: skip players already at the 2-tile limit, cap at 3 each
  for (const arr of [playerSpotlightsGood, playerSpotlightsBad]) {
    const keep: PlayerSpotlight[] = [];
    for (const entry of [...arr]) {
      if (keep.length >= 3) break;
      if (!canFeature(entry.playerName)) continue;
      keep.push(entry);
      markFeatured(entry.playerName);
    }
    arr.length = 0;
    arr.push(...keep);
  }

  // --- Most Picked Players (top 5) ---
  const mostPickedPlayers: MostPickedPlayer[] = Object.entries(byPlayer)
    .map(([playerName, picks]) => ({
      playerName,
      pickCount: picks.length,
      hitRate: round(
        picks.filter((p) => p.result === "hit").length / picks.length,
        3
      ),
      playerId: picks[0].props?.player_id ?? null,
      team: picks[0].props?.player_team ?? null,
      sport: picks[0].props?.games?.sport ?? "unknown",
    }))
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, 5);

  for (const p of mostPickedPlayers) markFeatured(p.playerName);

  // --- Most Picked Props (top 5, skip over-represented players) ---
  const mostPickedPropsAll = Object.entries(byProp)
    .map(([propId, picks]) => {
      const overCount = picks.filter((p) => p.selection === "over").length;
      const underCount = picks.filter((p) => p.selection === "under").length;
      const hits = picks.filter((p) => p.result === "hit").length;
      const representative = picks[0];
      return {
        propId,
        playerName: representative.props?.player_name ?? "Unknown",
        statCategory:
          representative.props?.stat_category ?? ("points" as StatCategory),
        line: representative.props?.line ?? 0,
        selectionBreakdown: { over: overCount, under: underCount },
        pickCount: picks.length,
        hitRate: round(hits / picks.length, 3),
        playerId: representative.props?.player_id ?? null,
        team: representative.props?.player_team ?? null,
        sport: representative.props?.games?.sport ?? "unknown",
      };
    })
    .sort((a, b) => b.pickCount - a.pickCount);
  const mostPickedProps: MostPickedProp[] = [];
  for (const p of mostPickedPropsAll) {
    if (mostPickedProps.length >= 5) break;
    if (!canFeature(p.playerName)) continue;
    mostPickedProps.push(p);
    markFeatured(p.playerName);
  }

  // --- Perfect Cards (require 3+ picks to count) ---
  const perfectCardEntries = cards.filter(
    (c) => c.total_picks >= 3 && c.score === c.total_picks
  );
  const perfectCardUserIds = [
    ...new Set(
      perfectCardEntries
        .map((c) => c.user_id)
        .filter((id): id is string => id !== null)
    ),
  ];

  // Fetch usernames for perfect card users
  let perfectUsernames: string[] = [];
  const usernameMap = new Map<string, string>();
  if (perfectCardUserIds.length > 0) {
    const { data: profileRows } = await typedFrom(supabase, "profiles")
      .select("id, username")
      .in("id", perfectCardUserIds);
    for (const r of (profileRows ?? []) as { id: string; username: string }[]) {
      if (r.username) usernameMap.set(r.id, r.username);
    }
    perfectUsernames = [...usernameMap.values()];
  }

  const perfectCards: PerfectCards = {
    count: perfectCardEntries.length,
    userIds: perfectCardUserIds,
    usernames: perfectUsernames,
    entries: perfectCardEntries
      .filter((c) => c.user_id && usernameMap.has(c.user_id))
      .map((c) => ({
        userId: c.user_id!,
        username: usernameMap.get(c.user_id!)!,
        cardId: c.id,
        score: c.score,
        totalPicks: c.total_picks,
      })),
  };

  // --- Stat Category Breakdown ---
  const statCategoryBreakdown: BreakdownEntry[] = Object.entries(byCategory)
    .map(([key, picks]) => ({
      key,
      hitRate: round(
        picks.filter((p) => p.result === "hit").length / picks.length,
        3
      ),
      pickCount: picks.length,
    }))
    .sort((a, b) => b.pickCount - a.pickCount);

  // --- Sport Breakdown ---
  const sportBreakdown: BreakdownEntry[] = Object.entries(bySport)
    .map(([key, picks]) => ({
      key,
      hitRate: round(
        picks.filter((p) => p.result === "hit").length / picks.length,
        3
      ),
      pickCount: picks.length,
    }))
    .sort((a, b) => b.pickCount - a.pickCount);

  // --- Team Breakdown ---
  const byTeam = groupBy(
    allPicks.filter((p) => p.props?.player_team),
    (p) => p.props!.player_team!
  );
  const teamBreakdown: BreakdownEntry[] = Object.entries(byTeam)
    .map(([key, picks]) => ({
      key,
      hitRate: round(
        picks.filter((p) => p.result === "hit").length / picks.length,
        3
      ),
      pickCount: picks.length,
    }))
    .sort((a, b) => b.pickCount - a.pickCount);

  // --- Consensus Picks (67%+ one side, 2+ picks) ---
  const consensusPicks: ConsensusPick[] = [];
  for (const [propId, picks] of Object.entries(byProp)) {
    if (picks.length < 2) continue;
    const overCount = picks.filter((p) => p.selection === "over").length;
    const underCount = picks.length - overCount;
    const dominant = overCount >= underCount ? "over" : "under";
    const dominantCount = dominant === "over" ? overCount : underCount;
    const dominantPct = dominantCount / picks.length;
    if (dominantPct < 0.67) continue;

    const dominantPicks = picks.filter((p) => p.selection === dominant);
    const dominantHits = dominantPicks.filter((p) => p.result === "hit").length;
    const wasCorrect = dominantHits / dominantPicks.length > 0.5;
    const representative = picks[0];

    consensusPicks.push({
      propId,
      playerName: representative.props?.player_name ?? "Unknown",
      statCategory: representative.props?.stat_category ?? "points",
      line: representative.props?.line ?? 0,
      pickCount: picks.length,
      dominantSide: dominant,
      dominantPct: round(dominantPct, 2),
      wasCorrect,
      sport: representative.props?.games?.sport ?? "unknown",
    });
  }
  consensusPicks.sort((a, b) => b.dominantPct - a.dominantPct || b.pickCount - a.pickCount);

  // Dedup consensus: skip players already at the 2-tile limit, cap at 10
  {
    const keep: ConsensusPick[] = [];
    for (const entry of [...consensusPicks]) {
      if (keep.length >= 10) break;
      if (!canFeature(entry.playerName)) continue;
      keep.push(entry);
      markFeatured(entry.playerName);
    }
    consensusPicks.length = 0;
    consensusPicks.push(...keep);
  }

  // --- Spotlights ---
  const spotlights = generateSpotlights({
    allPicks,
    byProp,
    byPlayer,
    bySport,
    byTeam,
    consensusPicks,
    perfectCards: { count: perfectCardEntries.length, userIds: perfectCardUserIds, usernames: perfectUsernames },
    platformHitRate,
    totalPicks,
    sportBreakdown,
    statCategoryBreakdown,
    teamBreakdown,
  });

  return {
    trapProps,
    lockProps,
    playerSpotlightsGood,
    playerSpotlightsBad,
    mostPickedPlayers,
    mostPickedProps,
    perfectCards,
    statCategoryBreakdown,
    sportBreakdown,
    teamBreakdown,
    consensusPicks,
    spotlights,
    platformHitRate: round(platformHitRate, 3),
    totalPicks,
    totalCards: cards.length,
    overCount: allPicks.filter((p) => p.selection === "over").length,
    underCount: allPicks.filter((p) => p.selection === "under").length,
  };
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

/**
 * Compute the daily recap for a given date string (YYYY-MM-DD).
 *
 * Returns the structured recap data, per-user personal highlights, and
 * a list of user IDs featured in callouts (for notification targeting).
 *
 * If no date is provided, defaults to yesterday (UTC).
 */
export async function computeDailyRecap(
  targetDate?: string
): Promise<{
  recapData: RecapData;
  personalHighlights: Record<string, PersonalHighlight>;
  featuredUserIds: string[];
}> {
  const date = targetDate ?? getYesterdayDateString();
  const startOfDay = `${date}T00:00:00Z`;
  const startOfNextDay = getNextDay(date);

  const supabase = createAdminClient();

  // ------------------------------------------------------------------
  // 1. Fetch all resolved cards for the date, with picks + props + games
  // ------------------------------------------------------------------
  const { data: rawCards, error } = await typedFrom(supabase, "cards")
    .select(
      "id, user_id, score, total_picks, picks(id, card_id, prop_id, selection, result, actual_value, props:prop_id(id, player_id, player_name, player_team, stat_category, line, games:game_id(sport)))"
    )
    .eq("status", "resolved")
    .gte("resolved_at", startOfDay)
    .lt("resolved_at", startOfNextDay);

  if (error) {
    throw new Error(`Failed to fetch resolved cards: ${error.message}`);
  }

  const cards = (rawCards ?? []) as unknown as ResolvedCardRow[];

  // Handle empty day
  if (cards.length === 0) {
    return emptyResult();
  }

  // Flatten all resolved picks (hit/miss only)
  const allPicks: ResolvedPickRow[] = [];
  for (const card of cards) {
    for (const pick of card.picks ?? []) {
      if (pick.result === "hit" || pick.result === "miss") {
        allPicks.push(pick);
      }
    }
  }

  if (allPicks.length === 0) {
    return emptyResult();
  }

  // ------------------------------------------------------------------
  // 2. Compute aggregations via shared helper
  // ------------------------------------------------------------------
  const recapData = await buildRecapData(allPicks, cards, supabase);

  // ------------------------------------------------------------------
  // 3. Compute personal highlights per user
  // ------------------------------------------------------------------
  const personalHighlights: Record<string, PersonalHighlight> = {};
  const cardsByUser = groupBy(
    cards.filter((c) => c.user_id !== null),
    (c) => c.user_id!
  );

  for (const [userId, userCards] of Object.entries(cardsByUser)) {
    const userPicks: ResolvedPickRow[] = [];
    for (const card of userCards) {
      for (const pick of card.picks ?? []) {
        if (pick.result === "hit" || pick.result === "miss") {
          userPicks.push(pick);
        }
      }
    }

    const userHits = userPicks.filter((p) => p.result === "hit").length;
    const userHitRate =
      userPicks.length > 0 ? round(userHits / userPicks.length, 3) : 0;

    // Best pick: largest positive margin
    let bestPick: PickHighlight | null = null;
    let worstPick: PickHighlight | null = null;
    let bestMargin = -Infinity;
    let worstMargin = Infinity;

    for (const pick of userPicks) {
      if (pick.actual_value === null || !pick.props) continue;

      const line = pick.props.line;
      const margin =
        pick.selection === "over"
          ? pick.actual_value - line
          : line - pick.actual_value;

      const highlight: PickHighlight = {
        playerName: pick.props.player_name,
        statCategory: pick.props.stat_category,
        line,
        selection: pick.selection,
        actualValue: pick.actual_value,
        margin: round(margin, 1),
      };

      if (margin > bestMargin) {
        bestMargin = margin;
        bestPick = highlight;
      }
      if (margin < worstMargin) {
        worstMargin = margin;
        worstPick = highlight;
      }
    }

    // Determine which callouts this user appears in
    const featuredIn: string[] = [];
    if (recapData.perfectCards.userIds.includes(userId)) {
      featuredIn.push("perfectCards");
    }

    personalHighlights[userId] = {
      cardsPlayed: userCards.length,
      hitRate: userHitRate,
      bestPick,
      worstPick,
      platformAvgHitRate: recapData.platformHitRate,
      featuredIn,
    };
  }

  // ------------------------------------------------------------------
  // 4. Collect featured user IDs
  // ------------------------------------------------------------------
  const featuredUserIds = [
    ...new Set([
      ...recapData.perfectCards.userIds,
      // Users in personal highlights who are featured
      ...Object.entries(personalHighlights)
        .filter(([, h]) => h.featuredIn.length > 0)
        .map(([userId]) => userId),
    ]),
  ];

  // ------------------------------------------------------------------
  // 5. Upsert into recaps table
  // ------------------------------------------------------------------
  const existingRecap = await typedFrom(supabase, "recaps")
    .select("id")
    .eq("recap_date", date)
    .maybeSingle();

  if (existingRecap.error) {
    throw new Error(`Failed to check for existing recap: ${existingRecap.error.message}`);
  }
  const isNewRecap = !existingRecap.data;

  if (existingRecap.data) {
    // Update existing
    const { error: updateError } = await typedFrom(supabase, "recaps")
      .update({
        recap_data: recapData as unknown as Record<string, unknown>,
        personal_highlights:
          personalHighlights as unknown as Record<string, unknown>,
        computed_at: new Date().toISOString(),
      })
      .eq("id", existingRecap.data.id);

    if (updateError) {
      throw new Error(`Failed to update recap: ${updateError.message}`);
    }
  } else {
    // Insert new
    const { error: insertError } = await typedFrom(supabase, "recaps").insert({
      recap_date: date,
      recap_data: recapData as unknown as Record<string, unknown>,
      personal_highlights:
        personalHighlights as unknown as Record<string, unknown>,
      computed_at: new Date().toISOString(),
    });

    if (insertError) {
      throw new Error(`Failed to insert recap: ${insertError.message}`);
    }
  }

  // ------------------------------------------------------------------
  // 6. Send notifications to featured users (only on first computation)
  // ------------------------------------------------------------------

  if (isNewRecap) {
    // Batch-fetch notification preferences for all featured users
    const { data: featuredProfiles } = featuredUserIds.length > 0
      ? await (supabase.from("profiles") as any)
          .select("id, notification_preferences")
          .in("id", featuredUserIds) as { data: Array<{ id: string; notification_preferences: NotificationPreferences | null }> | null }
      : { data: [] as Array<{ id: string; notification_preferences: NotificationPreferences | null }> };

    const prefsById = new Map<string, NotificationPreferences | null>(
      (featuredProfiles ?? []).map((p) => [p.id, p.notification_preferences])
    );

    const notificationPromises = featuredUserIds.map((userId) =>
      createNotification(supabase, {
        user_id: userId,
        type: "daily_recap",
        title: "Daily Recap Available",
        body: recapData.perfectCards.userIds.includes(userId)
          ? "You hit a perfect card yesterday! Check out the daily recap."
          : "The daily recap is ready. See how you and everyone else did.",
        metadata: { recap_date: date },
      }, prefsById.get(userId) ?? null).catch(() => {
        // Swallow notification errors — recap data is already saved
      })
    );

    await Promise.all(notificationPromises);
  }

  return { recapData, personalHighlights, featuredUserIds };
}

// ---------------------------------------------------------------------------
// Weekly computation
// ---------------------------------------------------------------------------

/**
 * Compute the weekly recap by aggregating the last 7 daily recaps and
 * querying raw resolved cards/picks for the full window.
 *
 * `endDate` defaults to yesterday (UTC). The window covers
 * [endDate - 6 days, endDate] inclusive (7 days total).
 *
 * The result is upserted into the `weekly_data` jsonb column on the
 * endDate's recap row.
 */
export async function computeWeeklyRecap(
  endDate?: string,
  startDate?: string,
): Promise<WeeklyRecapData> {
  const end = endDate ?? getYesterdayDateString();
  const start = startDate ?? getDateMinusDays(end, 6);

  const supabase = createAdminClient();

  // ------------------------------------------------------------------
  // 1. Fetch daily recaps for the 7-day window
  // ------------------------------------------------------------------
  const { data: recapRows, error: recapError } = await typedFrom(
    supabase,
    "recaps"
  )
    .select("id, recap_date, recap_data")
    .gte("recap_date", start)
    .lte("recap_date", end)
    .order("recap_date", { ascending: true });

  if (recapError) {
    throw new Error(`Failed to fetch recaps: ${recapError.message}`);
  }

  const recaps = (recapRows ?? []) as {
    id: string;
    recap_date: string;
    recap_data: RecapData;
  }[];

  // ------------------------------------------------------------------
  // 2. Build daily trend from stored recap data
  // ------------------------------------------------------------------
  const dailyTrend: WeeklyTrendPoint[] = [];
  let weekTotalHits = 0;
  let weekTotalPicks = 0;
  let weekTotalCards = 0;

  for (const recap of recaps) {
    const rd = recap.recap_data;
    if (!rd) continue;

    const dayPicks = rd.totalPicks ?? 0;
    const dayCards = rd.totalCards ?? 0;
    const dayHitRate = rd.platformHitRate ?? 0;
    const dayHits = Math.round(dayHitRate * dayPicks);

    dailyTrend.push({
      date: recap.recap_date,
      hitRate: round(dayHitRate, 3),
      totalPicks: dayPicks,
      totalCards: dayCards,
    });

    weekTotalHits += dayHits;
    weekTotalPicks += dayPicks;
    weekTotalCards += dayCards;
  }

  const weeklyHitRate =
    weekTotalPicks > 0 ? round(weekTotalHits / weekTotalPicks, 3) : 0;

  // ------------------------------------------------------------------
  // 3. Fetch raw resolved cards/picks for the full 7-day window
  //    (needed for top player, worst trap, best lock across the week)
  // ------------------------------------------------------------------
  const startOfWindow = `${start}T00:00:00Z`;
  const endOfWindow = getNextDay(end); // start of day after endDate

  const { data: rawCards, error: cardsError } = await typedFrom(
    supabase,
    "cards"
  )
    .select(
      "id, user_id, score, total_picks, picks(id, card_id, prop_id, selection, result, actual_value, props:prop_id(id, player_id, player_name, player_team, stat_category, line, games:game_id(sport)))"
    )
    .eq("status", "resolved")
    .gte("resolved_at", startOfWindow)
    .lt("resolved_at", endOfWindow);

  if (cardsError) {
    throw new Error(
      `Failed to fetch weekly resolved cards: ${cardsError.message}`
    );
  }

  const cards = (rawCards ?? []) as unknown as ResolvedCardRow[];

  // Flatten all resolved picks
  const allPicks: ResolvedPickRow[] = [];
  for (const card of cards) {
    for (const pick of card.picks ?? []) {
      if (pick.result === "hit" || pick.result === "miss") {
        allPicks.push(pick);
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. Build full RecapData via shared helper (breakdowns, spotlights, etc.)
  // ------------------------------------------------------------------
  let weeklyRecapData: RecapData | null = null;
  if (allPicks.length > 0) {
    weeklyRecapData = await buildRecapData(allPicks, cards, supabase);
  }

  // ------------------------------------------------------------------
  // 5. Derive topPlayer / worstTrap / bestLock from raw picks
  //    (these use different thresholds than buildRecapData)
  // ------------------------------------------------------------------
  const weeklyTopMin = Math.max(3, Math.floor(weekTotalPicks / 30));
  let topPlayer: WeeklyRecapData["topPlayer"] = null;
  let worstTrap: TrapOrLockProp | null = null;
  let bestLock: TrapOrLockProp | null = null;

  if (allPicks.length > 0) {
    const weekByPlayer = groupBy(allPicks, (p) => p.props?.player_name ?? "Unknown");
    const weekByProp = groupBy(allPicks, (p) => p.prop_id);

    // Most picked player: player with the most picks across the week
    let mostPicks = 0;
    for (const [playerName, picks] of Object.entries(weekByPlayer)) {
      if (picks.length < weeklyTopMin) continue;
      if (picks.length > mostPicks) {
        mostPicks = picks.length;
        const hits = picks.filter((p) => p.result === "hit").length;
        topPlayer = {
          playerName,
          hitRate: round(hits / picks.length, 3),
          pickCount: picks.length,
          sport: picks[0].props?.games?.sport ?? "unknown",
        };
      }
    }

    // Worst trap & best lock: extreme hit rates with min picks
    let lowestRate = Infinity;
    let highestRate = -Infinity;
    for (const [propId, picks] of Object.entries(weekByProp)) {
      if (picks.length < weeklyTopMin) continue;
      const hits = picks.filter((p) => p.result === "hit").length;
      const rate = hits / picks.length;
      const representative = picks[0];
      const entry: TrapOrLockProp = {
        propId,
        playerName: representative.props?.player_name ?? "Unknown",
        statCategory: representative.props?.stat_category ?? "points",
        line: representative.props?.line ?? 0,
        hitRate: round(rate, 3),
        pickCount: picks.length,
        playerId: representative.props?.player_id ?? null,
        team: representative.props?.player_team ?? null,
        sport: representative.props?.games?.sport ?? "unknown",
      };
      if (rate < lowestRate) { lowestRate = rate; worstTrap = entry; }
      if (rate > highestRate) { highestRate = rate; bestLock = entry; }
    }

    // Deduplicate: if the same prop is both trap and lock, keep only the more fitting role
    if (worstTrap && bestLock && worstTrap.propId === bestLock.propId) {
      if (worstTrap.hitRate < 0.5) bestLock = null;
      else worstTrap = null;
    }
  }

  // ------------------------------------------------------------------
  // 6. Compute wager highlights from resolved wagered cards
  // ------------------------------------------------------------------
  let wagerHighlights: WagerHighlights | null = null;

  const { data: wageredCards } = await (supabase.from("cards") as any)
    .select("id, user_id, fire_token_wager, fire_token_payout, score, total_picks")
    .eq("status", "resolved")
    .not("fire_token_wager", "is", null)
    .gte("resolved_at", startOfWindow)
    .lt("resolved_at", endOfWindow);

  if (wageredCards && wageredCards.length > 0) {
    // Fetch usernames for wagered card owners
    const userIds = [...new Set((wageredCards as { user_id: string }[]).map((c) => c.user_id))];
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, username")
      .in("id", userIds);
    const usernameMap = new Map<string, string>();
    for (const p of (profiles ?? []) as { id: string; username: string }[]) {
      usernameMap.set(p.id, p.username);
    }

    let totalWagered = 0;
    let totalPayouts = 0;
    let biggestPayout: WagerHighlights["biggestPayout"] = null;
    let biggestBust: WagerHighlights["biggestBust"] = null;
    const userTotals = new Map<string, { wagered: number; net: number }>();

    for (const card of wageredCards as { id: string; user_id: string; fire_token_wager: number; fire_token_payout: number | null; score: number; total_picks: number }[]) {
      const wager = card.fire_token_wager;
      const payout = card.fire_token_payout ?? 0;
      totalWagered += wager;
      totalPayouts += payout;

      // Track per-user totals
      const existing = userTotals.get(card.user_id) ?? { wagered: 0, net: 0 };
      existing.wagered += wager;
      existing.net += payout - wager;
      userTotals.set(card.user_id, existing);

      const username = usernameMap.get(card.user_id) ?? "Unknown";

      // Biggest payout
      if (payout > 0 && (!biggestPayout || payout > biggestPayout.payout)) {
        biggestPayout = {
          username,
          wager,
          payout,
          multiplier: Math.round((payout / wager) * 10) / 10,
          cardId: card.id,
        };
      }

      // Biggest bust (largest wager with 0 payout)
      if (payout === 0 && (!biggestBust || wager > biggestBust.wager)) {
        biggestBust = { username, wager, cardId: card.id };
      }
    }

    // Top wagerer by total amount wagered
    let topWagerer: WagerHighlights["topWagerer"] = null;
    let maxWagered = 0;
    for (const [userId, totals] of userTotals) {
      if (totals.wagered > maxWagered) {
        maxWagered = totals.wagered;
        topWagerer = {
          username: usernameMap.get(userId) ?? "Unknown",
          totalWagered: totals.wagered,
          netResult: totals.net,
        };
      }
    }

    wagerHighlights = { biggestPayout, biggestBust, topWagerer, totalWagered, totalPayouts };
  }

  // ------------------------------------------------------------------
  // 7. Assemble the weekly recap data
  // ------------------------------------------------------------------
  const weeklyData: WeeklyRecapData = {
    dailyTrend,
    weeklyHitRate,
    totalPicks: weekTotalPicks,
    totalCards: weekTotalCards,
    topPlayer,
    worstTrap,
    bestLock,
    startDate: start,
    endDate: end,
    recapData: weeklyRecapData,
    wagerHighlights,
  };

  // ------------------------------------------------------------------
  // 8. Upsert weekly_data on the endDate's recap row
  // ------------------------------------------------------------------
  const endRecap = recaps.find((r) => r.recap_date === end);

  if (endRecap) {
    const { error: updateError } = await typedFrom(supabase, "recaps")
      .update({
        weekly_data: weeklyData as unknown as Record<string, unknown>,
      })
      .eq("id", endRecap.id);

    if (updateError) {
      throw new Error(
        `Failed to upsert weekly_data: ${updateError.message}`
      );
    }
  } else {
    // No recap row for endDate yet — create a minimal one with weekly_data
    const { error: insertError } = await typedFrom(supabase, "recaps").insert({
      recap_date: end,
      recap_data: {} as Record<string, unknown>,
      weekly_data: weeklyData as unknown as Record<string, unknown>,
      computed_at: new Date().toISOString(),
    });

    if (insertError) {
      throw new Error(
        `Failed to insert recap with weekly_data: ${insertError.message}`
      );
    }
  }

  return weeklyData;
}

// ---------------------------------------------------------------------------
// Spotlight Generator — finds anomalies and trends worth calling out
// ---------------------------------------------------------------------------

interface SpotlightInput {
  allPicks: ResolvedPickRow[];
  byProp: Record<string, ResolvedPickRow[]>;
  byPlayer: Record<string, ResolvedPickRow[]>;
  bySport: Record<string, ResolvedPickRow[]>;
  byTeam: Record<string, ResolvedPickRow[]>;
  consensusPicks: ConsensusPick[];
  perfectCards: PerfectCards;
  platformHitRate: number;
  totalPicks: number;
  sportBreakdown: BreakdownEntry[];
  statCategoryBreakdown: BreakdownEntry[];
  teamBreakdown: BreakdownEntry[];
}

function generateSpotlights(input: SpotlightInput): Spotlight[] {
  const {
    allPicks,
    byProp,
    byPlayer,
    consensusPicks,
    perfectCards,
    platformHitRate,
    totalPicks,
    statCategoryBreakdown,
    teamBreakdown,
  } = input;

  const spotlights: Spotlight[] = [];
  const avgRate = platformHitRate;

  // Build player entries with computed rates (min 2 picks)
  const playerEntries = Object.entries(byPlayer)
    .filter(([, picks]) => picks.length >= 2)
    .map(([name, picks]) => {
      const hits = picks.filter((p) => p.result === "hit").length;
      const rate = hits / picks.length;
      return { name, picks, rate, delta: rate - avgRate };
    })
    .sort((a, b) => b.picks.length - a.picks.length);

  // 1. Player locks — best performers (above avg, or top by delta)
  const locks = [...playerEntries]
    .filter((e) => e.delta > 0)
    .sort((a, b) => b.delta - a.delta || b.picks.length - a.picks.length);

  for (const entry of locks.slice(0, 2)) {
    spotlights.push({
      type: "player_lock",
      sentiment: "positive",
      headline: `${entry.name} was money`,
      detail: `${entry.picks.length} picks — ${Math.round(entry.rate * 100)}% hit`,
      value: Math.round(entry.rate * 100),
      valueSuffix: "% hit",
      subject: entry.name,
      sport: entry.picks[0].props?.games?.sport ?? undefined,
      playerId: entry.picks[0].props?.player_id ?? undefined,
      team: entry.picks[0].props?.player_team ?? undefined,
    });
  }

  // 2. Player traps — worst performers (below avg, or bottom by delta)
  const traps = [...playerEntries]
    .filter((e) => e.delta < 0)
    .sort((a, b) => a.delta - b.delta || b.picks.length - a.picks.length);

  for (const entry of traps.slice(0, 2)) {
    const hitPct = Math.round(entry.rate * 100);
    spotlights.push({
      type: "player_trap",
      sentiment: "negative",
      headline: `${entry.name} fooled everyone`,
      detail: `${entry.picks.length} picks — ${hitPct === 0 ? "0" : `only ${hitPct}`}% hit`,
      value: hitPct,
      valueSuffix: "% hit",
      subject: entry.name,
      sport: entry.picks[0].props?.games?.sport ?? undefined,
      playerId: entry.picks[0].props?.player_id ?? undefined,
      team: entry.picks[0].props?.player_team ?? undefined,
    });
  }

  // 3. Unanimous props — everyone picked the same side
  const unanimousProps = Object.entries(byProp)
    .filter(([, picks]) => picks.length >= 2)
    .filter(([, picks]) => {
      const overCount = picks.filter((p) => p.selection === "over").length;
      return overCount === 0 || overCount === picks.length;
    })
    .sort((a, b) => b[1].length - a[1].length);

  for (const [unanimousPropId, picks] of unanimousProps.slice(0, 3)) {
    const overCount = picks.filter((p) => p.selection === "over").length;
    const side = overCount > 0 ? "OVER" : "UNDER";
    const rep = picks[0];
    const name = rep.props?.player_name ?? "Unknown";
    const stat = rep.props?.stat_category ?? "points";

    // Aggregate across ALL props for this player+stat this week
    const weeklyPicks = allPicks.filter(
      (p) =>
        p.props?.player_name === name &&
        p.props?.stat_category === stat,
    );
    const weeklyHits = weeklyPicks.filter((p) => p.result === "hit").length;
    const weeklyTotal = weeklyPicks.length;
    const weeklyHitRate = weeklyTotal > 0 ? weeklyHits / weeklyTotal : 0;
    const weeklyAllHit = weeklyTotal > 0 && weeklyHits === weeklyTotal;
    const weeklyAllMiss = weeklyTotal > 0 && weeklyHits === 0;

    const statSuffix = weeklyAllHit
      ? " — all correct"
      : weeklyAllMiss
        ? " — all wrong"
        : ` — ${Math.round(weeklyHitRate * 100)}% hit rate`;

    spotlights.push({
      type: "prop_unanimous",
      sentiment: weeklyAllHit ? "positive" : weeklyAllMiss ? "negative" : "neutral",
      headline: `Unanimous ${side} on ${name}`,
      detail: `${weeklyTotal} ${catLabel(stat)} pick${weeklyTotal !== 1 ? "s" : ""} this week${statSuffix}`,
      value: picks.length,
      valueSuffix: ` picked ${side}`,
      subject: name,
      sport: rep.props?.games?.sport ?? undefined,
      playerId: rep.props?.player_id ?? undefined,
      team: rep.props?.player_team ?? undefined,
      propId: unanimousPropId,
      statCategory: stat,
    });
  }

  // 4. Stat category extremes — always show best and worst
  const sortedCategories = [...statCategoryBreakdown]
    .filter((e) => e.pickCount >= 1)
    .sort((a, b) => b.hitRate - a.hitRate);

  if (sortedCategories.length >= 1) {
    const best = sortedCategories[0];
    spotlights.push({
      type: "category_hot",
      sentiment: "positive",
      headline: `${catLabel(best.key)} was on fire`,
      detail: `${Math.round(best.hitRate * 100)}% hit rate across ${best.pickCount} picks`,
      value: Math.round(best.hitRate * 100),
      valueSuffix: "%",
      subject: best.key,
    });
  }
  if (sortedCategories.length >= 2) {
    const worst = sortedCategories[sortedCategories.length - 1];
    if (worst.key !== sortedCategories[0].key) {
      const pct = Math.round(worst.hitRate * 100);
      spotlights.push({
        type: "category_cold",
        sentiment: "negative",
        headline: `${catLabel(worst.key)} burned pickers`,
        detail: `${pct === 0 ? "0" : `Only ${pct}`}% hit rate across ${worst.pickCount} picks`,
        value: pct,
        valueSuffix: "%",
        subject: worst.key,
      });
    }
  }

  // 5. Team extremes — always show best and worst
  const sortedTeams = [...teamBreakdown]
    .filter((e) => e.pickCount >= 2)
    .sort((a, b) => b.hitRate - a.hitRate);

  if (sortedTeams.length >= 1) {
    const best = sortedTeams[0];
    spotlights.push({
      type: "team_hot",
      sentiment: "positive",
      headline: `${best.key} props were cash`,
      detail: `${Math.round(best.hitRate * 100)}% hit rate across ${best.pickCount} picks`,
      value: Math.round(best.hitRate * 100),
      valueSuffix: "%",
      subject: best.key,
    });
  }
  if (sortedTeams.length >= 2) {
    const worst = sortedTeams[sortedTeams.length - 1];
    if (worst.key !== sortedTeams[0].key) {
      const pct = Math.round(worst.hitRate * 100);
      spotlights.push({
        type: "team_cold",
        sentiment: "negative",
        headline: `${worst.key} was a trap`,
        detail: `${pct === 0 ? "0" : `Only ${pct}`}% hit rate across ${worst.pickCount} picks`,
        value: pct,
        valueSuffix: "%",
        subject: worst.key,
      });
    }
  }

  // 6. Consensus upset — crowd agreed but was wrong
  const wrongConsensus = consensusPicks.filter((c) => !c.wasCorrect);
  for (const entry of wrongConsensus.slice(0, 2)) {
    // Aggregate across ALL props for this player+stat this week
    const weeklyPicks = allPicks.filter(
      (p) =>
        p.props?.player_name === entry.playerName &&
        p.props?.stat_category === entry.statCategory,
    );
    const weeklyHits = weeklyPicks.filter((p) => p.result === "hit").length;
    const weeklyTotal = weeklyPicks.length;
    const weeklyHitRate = weeklyTotal > 0 ? weeklyHits / weeklyTotal : 0;
    const weeklyAllMiss = weeklyTotal > 0 && weeklyHits === 0;

    const statSuffix = weeklyAllMiss
      ? " — all wrong"
      : ` — ${Math.round(weeklyHitRate * 100)}% hit rate`;

    spotlights.push({
      type: "consensus_upset",
      sentiment: "negative",
      headline: `Crowd got burned on ${entry.playerName}`,
      detail: `${weeklyTotal} ${catLabel(entry.statCategory)} pick${weeklyTotal !== 1 ? "s" : ""} this week${statSuffix}`,
      value: Math.round(entry.dominantPct * 100),
      valueSuffix: `% ${entry.dominantSide}`,
      subject: entry.playerName,
      sport: entry.sport,
      propId: entry.propId,
      statCategory: entry.statCategory,
    });
  }

  // 7. Over/under split — always show the skew
  if (totalPicks > 0) {
    const overTotal = allPicks.filter((p) => p.selection === "over").length;
    const overPct = overTotal / totalPicks;
    if (overPct >= 0.5) {
      spotlights.push({
        type: "over_under_skew",
        sentiment: "neutral",
        headline: overPct >= 0.55 ? "Overs were popular" : "Even over/under split",
        detail: `${Math.round(overPct * 100)}% of all picks were OVER`,
        value: Math.round(overPct * 100),
        valueSuffix: "% over",
      });
    } else {
      spotlights.push({
        type: "over_under_skew",
        sentiment: "neutral",
        headline: "Unders were popular",
        detail: `${Math.round((1 - overPct) * 100)}% of all picks were UNDER`,
        value: Math.round((1 - overPct) * 100),
        valueSuffix: "% under",
      });
    }
  }

  // 8. Perfect cards (with usernames)
  if (perfectCards.count > 0) {
    const names = perfectCards.usernames.length > 0
      ? perfectCards.usernames.map((u) => `@${u}`).join(", ")
      : `${perfectCards.count} ${perfectCards.count === 1 ? "player" : "players"}`;
    spotlights.push({
      type: "perfect_cards",
      sentiment: "positive",
      headline: `${perfectCards.count} perfect ${perfectCards.count === 1 ? "card" : "cards"}`,
      detail: names,
      value: perfectCards.count,
      valueSuffix: "",
    });
  }

  // 9. Most picked player — always include if not already spotlighted
  if (playerEntries.length > 0) {
    const top = playerEntries[0]; // already sorted by pick count desc
    const alreadySpotlit = spotlights.some((s) => s.subject === top.name);
    if (!alreadySpotlit) {
      spotlights.push({
        type: top.rate >= 0.5 ? "player_lock" : "player_trap",
        sentiment: top.rate >= 0.5 ? "positive" : "negative",
        headline: `${top.name} was most picked`,
        detail: `${top.picks.length} picks — ${Math.round(top.rate * 100)}% hit rate`,
        value: top.picks.length,
        valueSuffix: " picks",
        subject: top.name,
        sport: top.picks[0].props?.games?.sport ?? undefined,
        playerId: top.picks[0].props?.player_id ?? undefined,
        team: top.picks[0].props?.player_team ?? undefined,
      });
    }
  }

  return spotlights.slice(0, 12);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyResult(): {
  recapData: RecapData;
  personalHighlights: Record<string, PersonalHighlight>;
  featuredUserIds: string[];
} {
  return {
    recapData: {
      trapProps: [],
      lockProps: [],
      playerSpotlightsGood: [],
      playerSpotlightsBad: [],
      mostPickedPlayers: [],
      mostPickedProps: [],
      perfectCards: { count: 0, userIds: [], usernames: [] },
      statCategoryBreakdown: [],
      sportBreakdown: [],
      teamBreakdown: [],
      consensusPicks: [],
      spotlights: [],
      platformHitRate: 0,
      totalPicks: 0,
      totalCards: 0,
      overCount: 0,
      underCount: 0,
    },
    personalHighlights: {},
    featuredUserIds: [],
  };
}

function getYesterdayDateString(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function getNextDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().slice(0, 10)}T00:00:00Z`;
}

function getDateMinusDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Re-export date utilities (canonical source: ./dates.ts)
export { getMondayOfWeek, getSundayOfWeek } from "./dates";

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}
