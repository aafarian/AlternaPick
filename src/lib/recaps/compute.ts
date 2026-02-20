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
import type {
  StatCategory,
  PickSelection,
  Card,
  Pick,
  Prop,
  Game,
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
}

export interface PlayerSpotlight {
  playerName: string;
  hitRate: number;
  pickCount: number;
  sport: string;
}

export interface MostPickedPlayer {
  playerName: string;
  pickCount: number;
  hitRate: number;
}

export interface MostPickedProp {
  propId: string;
  playerName: string;
  statCategory: StatCategory;
  line: number;
  selectionBreakdown: { over: number; under: number };
  pickCount: number;
  hitRate: number;
}

export interface PerfectCards {
  count: number;
  userIds: string[];
}

export interface BreakdownEntry {
  key: string;
  hitRate: number;
  pickCount: number;
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
  platformHitRate: number;
  totalPicks: number;
  totalCards: number;
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
    player_name: string;
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
      "id, user_id, score, total_picks, picks(id, card_id, prop_id, selection, result, actual_value, props:prop_id(id, player_name, stat_category, line, games:game_id(sport)))"
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
  // 2. Compute aggregations
  // ------------------------------------------------------------------

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

  // --- Trap Props (hit rate < 0.30, min 5 picks) ---
  const trapProps: TrapOrLockProp[] = [];
  const lockProps: TrapOrLockProp[] = [];

  for (const [propId, picks] of Object.entries(byProp)) {
    if (picks.length < 5) continue;
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
    };
    if (rate < 0.3) trapProps.push(entry);
    if (rate > 0.75) lockProps.push(entry);
  }

  // Sort trap by lowest hit rate, lock by highest
  trapProps.sort((a, b) => a.hitRate - b.hitRate);
  lockProps.sort((a, b) => b.hitRate - a.hitRate);

  // --- Player Spotlights ---
  const playerSpotlightsGood: PlayerSpotlight[] = [];
  const playerSpotlightsBad: PlayerSpotlight[] = [];

  for (const [playerName, picks] of Object.entries(byPlayer)) {
    if (picks.length < 3) continue;
    const hits = picks.filter((p) => p.result === "hit").length;
    const rate = hits / picks.length;
    const sport = picks[0].props?.games?.sport ?? "unknown";
    const entry: PlayerSpotlight = {
      playerName,
      hitRate: round(rate, 3),
      pickCount: picks.length,
      sport,
    };
    if (rate > 0.8) playerSpotlightsGood.push(entry);
    if (rate < 0.25) playerSpotlightsBad.push(entry);
  }

  playerSpotlightsGood.sort((a, b) => b.hitRate - a.hitRate);
  playerSpotlightsBad.sort((a, b) => a.hitRate - b.hitRate);

  // --- Most Picked Players (top 5) ---
  const mostPickedPlayers: MostPickedPlayer[] = Object.entries(byPlayer)
    .map(([playerName, picks]) => ({
      playerName,
      pickCount: picks.length,
      hitRate: round(
        picks.filter((p) => p.result === "hit").length / picks.length,
        3
      ),
    }))
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, 5);

  // --- Most Picked Props (top 5) ---
  const mostPickedProps: MostPickedProp[] = Object.entries(byProp)
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
      };
    })
    .sort((a, b) => b.pickCount - a.pickCount)
    .slice(0, 5);

  // --- Perfect Cards ---
  const perfectCardEntries = cards.filter(
    (c) => c.total_picks > 0 && c.score === c.total_picks
  );
  const perfectCardUserIds = [
    ...new Set(
      perfectCardEntries
        .map((c) => c.user_id)
        .filter((id): id is string => id !== null)
    ),
  ];
  const perfectCards: PerfectCards = {
    count: perfectCardEntries.length,
    userIds: perfectCardUserIds,
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

  const recapData: RecapData = {
    trapProps,
    lockProps,
    playerSpotlightsGood,
    playerSpotlightsBad,
    mostPickedPlayers,
    mostPickedProps,
    perfectCards,
    statCategoryBreakdown,
    sportBreakdown,
    platformHitRate: round(platformHitRate, 3),
    totalPicks,
    totalCards: cards.length,
  };

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
    if (perfectCardUserIds.includes(userId)) {
      featuredIn.push("perfectCards");
    }

    personalHighlights[userId] = {
      cardsPlayed: userCards.length,
      hitRate: userHitRate,
      bestPick,
      worstPick,
      platformAvgHitRate: round(platformHitRate, 3),
      featuredIn,
    };
  }

  // ------------------------------------------------------------------
  // 4. Collect featured user IDs
  // ------------------------------------------------------------------
  const featuredUserIds = [
    ...new Set([
      ...perfectCardUserIds,
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
  // 6. Send notifications to featured users
  // ------------------------------------------------------------------
  const notificationPromises = featuredUserIds.map((userId) =>
    createNotification(supabase, {
      user_id: userId,
      type: "daily_recap",
      title: "Daily Recap Available",
      body: perfectCardUserIds.includes(userId)
        ? "You hit a perfect card yesterday! Check out the daily recap."
        : "The daily recap is ready. See how you and everyone else did.",
      metadata: { recap_date: date },
    }).catch(() => {
      // Swallow notification errors — recap data is already saved
    })
  );

  await Promise.all(notificationPromises);

  return { recapData, personalHighlights, featuredUserIds };
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
      perfectCards: { count: 0, userIds: [] },
      statCategoryBreakdown: [],
      sportBreakdown: [],
      platformHitRate: 0,
      totalPicks: 0,
      totalCards: 0,
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
