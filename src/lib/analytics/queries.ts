/**
 * Prop Analytics Query Layer
 *
 * All functions query resolved picks (result IN ('hit', 'miss')) scoped to a
 * specific user via the card join (picks.card_id -> cards.user_id).
 *
 * Uses (supabase.from() as any) + typed result casts to work around the known
 * Supabase PostgREST type inference issue with chained/joined queries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GameMode, StatCategory } from "@/lib/supabase/types";
import { logError } from "@/lib/logger";

/** Resolved mode filter: undefined or "all" means no filtering. */
type ModeFilter = GameMode | "all" | undefined;

/** Resolved sport filter: undefined or "all" means no filtering. */
type SportFilter = string | undefined;
import type {
  CategoryStats,
  PlayerStats,
  DirectionStats,
  TrendPoint,
  CoinTrendPoint,
  CardSizeStats,
  TeamStats,
  ScoreDistributionEntry,
  GameModeStats,
  CardHistoryItem,
} from "./types";
import { STARTING_BALANCE } from "@/lib/heatscore/constants";

// ---------- Internal helpers ----------

/** Row shape returned by the pick + prop + card join */
interface ResolvedPickRow {
  selection: "over" | "under";
  result: "hit" | "miss";
  cards: { user_id: string | null; resolved_at: string | null } | null;
  props: {
    stat_category: StatCategory;
    player_name: string;
    player_id: string | null;
    player_team: string | null;
    games: { sport: string } | null;
  } | null;
}

/** Row shape for resolved cards with card_size and game_mode */
interface ResolvedCardRow {
  id: string;
  card_size: number;
  game_mode: GameMode;
  score: number;
  total_picks: number;
  resolved_at: string | null;
}

/**
 * Fetch all resolved picks for a user. Because Supabase PostgREST cannot
 * filter on a joined column (cards.user_id) efficiently, we first grab the
 * user's resolved card IDs then fetch picks matching those card IDs.
 */
async function fetchResolvedPicks(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<ResolvedPickRow[]> {
  // Step 1 – get card IDs belonging to this user that are resolved
  let cardsQuery = (supabase.from("cards") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("status", "resolved");

  if (mode && mode !== "all") {
    cardsQuery = cardsQuery.eq("game_mode", mode);
  }

  const cardsResult = await cardsQuery;

  if (cardsResult.error) {
    logError("analytics", `fetchResolvedPicks: failed to fetch card IDs: ${cardsResult.error.message}`, "fetchResolvedPicks", cardsResult.error);
    throw new Error(`Failed to fetch resolved card IDs: ${cardsResult.error.message}`);
  }
  if (!cardsResult.data) return [];

  const cardIds = (cardsResult.data as { id: string }[]).map((c) => c.id);
  if (cardIds.length === 0) return [];

  // Step 2 – get resolved picks for those cards with prop + game join
  const picksResult = await (supabase.from("picks") as any)
    .select(
      "selection, result, cards:card_id(user_id, resolved_at), props:prop_id(stat_category, player_name, player_id, player_team, games:game_id(sport))"
    )
    .in("card_id", cardIds)
    .in("result", ["hit", "miss"]);

  if (picksResult.error) {
    logError("analytics", `fetchResolvedPicks: failed to fetch picks: ${picksResult.error.message}`, "fetchResolvedPicks", picksResult.error);
    throw new Error(`Failed to fetch resolved picks: ${picksResult.error.message}`);
  }
  if (!picksResult.data) return [];

  let picks = picksResult.data as ResolvedPickRow[];

  // Client-side sport filter
  if (sport && sport !== "all") {
    picks = picks.filter((p) => p.props?.games?.sport === sport);
  }

  return picks;
}

/**
 * Fetch all resolved cards for a user with card_size, game_mode, score, etc.
 * Used by card-level analytics (card size stats, score distribution, game mode stats).
 */
async function fetchResolvedCards(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<ResolvedCardRow[]> {
  let query = (supabase.from("cards") as any)
    .select("id, card_size, game_mode, score, total_picks, resolved_at")
    .eq("user_id", userId)
    .eq("status", "resolved");

  if (mode && mode !== "all") {
    query = query.eq("game_mode", mode);
  }

  const result = await query;

  if (result.error) {
    logError("analytics", `fetchResolvedCards: failed to fetch cards: ${result.error.message}`, "fetchResolvedCards", result.error);
    throw new Error(`Failed to fetch resolved cards: ${result.error.message}`);
  }
  if (!result.data) return [];

  let cards = result.data as ResolvedCardRow[];

  // When sport filter is active, keep only cards that have at least one pick
  // matching the sport (cards don't have a sport column directly).
  if (sport && sport !== "all") {
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length === 0) return [];

    const picksResult = await (supabase.from("picks") as any)
      .select("card_id, props:prop_id(games:game_id(sport))")
      .in("card_id", cardIds)
      .in("result", ["hit", "miss"]);

    if (picksResult.error) {
      logError("analytics", `fetchResolvedCards: failed to fetch picks for sport filter: ${picksResult.error.message}`, "fetchResolvedCards", picksResult.error);
      throw new Error(`Failed to fetch picks for sport filter: ${picksResult.error.message}`);
    }
    if (!picksResult.data) return [];

    const matchingCardIds = new Set<string>();
    for (const pick of picksResult.data as { card_id: string; props: { games: { sport: string } | null } | null }[]) {
      if (pick.props?.games?.sport === sport) {
        matchingCardIds.add(pick.card_id);
      }
    }

    cards = cards.filter((c) => matchingCardIds.has(c.id));
  }

  return cards;
}

// ---------- Public query functions ----------

/**
 * Get hit-rate stats grouped by stat category.
 */
export async function getCategoryStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<CategoryStats[]> {
  const picks = await fetchResolvedPicks(supabase, userId, mode, sport);

  const map = new Map<StatCategory, { hits: number; total: number }>();

  for (const pick of picks) {
    const cat = pick.props?.stat_category;
    if (!cat) continue;

    const entry = map.get(cat) ?? { hits: 0, total: 0 };
    entry.total += 1;
    if (pick.result === "hit") entry.hits += 1;
    map.set(cat, entry);
  }

  const results: CategoryStats[] = [];
  for (const [category, { hits, total }] of map) {
    results.push({
      category,
      hits,
      total,
      rate: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    });
  }

  // Sort by total picks descending for consistent ordering
  results.sort((a, b) => b.total - a.total);
  return results;
}

/**
 * Get hit-rate stats grouped by player name, ordered by total picks descending.
 */
export async function getPlayerStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 10,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<PlayerStats[]> {
  const picks = await fetchResolvedPicks(supabase, userId, mode, sport);

  const map = new Map<string, { hits: number; total: number; sport?: string; player_id?: string | null }>();

  for (const pick of picks) {
    const name = pick.props?.player_name;
    if (!name) continue;

    const entry = map.get(name) ?? { hits: 0, total: 0 };
    entry.total += 1;
    if (pick.result === "hit") entry.hits += 1;
    if (!entry.sport && pick.props?.games?.sport) {
      entry.sport = pick.props.games.sport;
    }
    if (!entry.player_id && pick.props?.player_id) {
      entry.player_id = pick.props.player_id;
    }
    map.set(name, entry);
  }

  const results: PlayerStats[] = [];
  for (const [player_name, { hits, total, sport: playerSport, player_id }] of map) {
    results.push({
      player_name,
      player_id,
      sport: playerSport,
      hits,
      total,
      rate: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    });
  }

  // Sort by total picks descending then limit
  results.sort((a, b) => b.total - a.total);
  return results.slice(0, limit);
}

/**
 * Get hit-rate stats grouped by pick direction (over / under).
 */
export async function getDirectionStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<DirectionStats> {
  const picks = await fetchResolvedPicks(supabase, userId, mode, sport);

  const stats: DirectionStats = {
    over: { hits: 0, total: 0, rate: 0 },
    under: { hits: 0, total: 0, rate: 0 },
  };

  for (const pick of picks) {
    const dir = pick.selection;
    if (dir !== "over" && dir !== "under") continue;

    stats[dir].total += 1;
    if (pick.result === "hit") stats[dir].hits += 1;
  }

  stats.over.rate =
    stats.over.total > 0
      ? Math.round((stats.over.hits / stats.over.total) * 1000) / 1000
      : 0;
  stats.under.rate =
    stats.under.total > 0
      ? Math.round((stats.under.hits / stats.under.total) * 1000) / 1000
      : 0;

  return stats;
}

/**
 * Get daily trend data for pick hit rates over the last N days.
 * Groups by the card's resolved_at date.
 */
export async function getTrendData(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number = 30,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<TrendPoint[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString();

  // Step 1 – get resolved cards in the date range
  let cardsQuery = (supabase.from("cards") as any)
    .select("id, resolved_at")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .gte("resolved_at", cutoffISO);

  if (mode && mode !== "all") {
    cardsQuery = cardsQuery.eq("game_mode", mode);
  }

  const cardsResult = await cardsQuery;

  if (cardsResult.error) {
    logError("analytics", `getTrendData: failed to fetch cards: ${cardsResult.error.message}`, "getTrendData", cardsResult.error);
    throw new Error(`Failed to fetch trend cards: ${cardsResult.error.message}`);
  }
  if (!cardsResult.data) return [];

  const cards = cardsResult.data as {
    id: string;
    resolved_at: string | null;
  }[];
  if (cards.length === 0) return [];

  // Build card-id -> date map
  const cardDateMap = new Map<string, string>();
  for (const card of cards) {
    if (!card.resolved_at) continue;
    const dateStr = card.resolved_at.slice(0, 10); // YYYY-MM-DD
    cardDateMap.set(card.id, dateStr);
  }

  const cardIds = [...cardDateMap.keys()];
  if (cardIds.length === 0) return [];

  // Step 2 – get resolved picks for those cards (with game join for sport filter)
  const picksResult = await (supabase.from("picks") as any)
    .select("card_id, result, props:prop_id(games:game_id(sport))")
    .in("card_id", cardIds)
    .in("result", ["hit", "miss"]);

  if (picksResult.error) {
    logError("analytics", `getTrendData: failed to fetch picks: ${picksResult.error.message}`, "getTrendData", picksResult.error);
    throw new Error(`Failed to fetch trend picks: ${picksResult.error.message}`);
  }
  if (!picksResult.data) return [];

  let picks = picksResult.data as {
    card_id: string;
    result: "hit" | "miss";
    props: { games: { sport: string } | null } | null;
  }[];

  // Client-side sport filter
  if (sport && sport !== "all") {
    picks = picks.filter((p) => p.props?.games?.sport === sport);
  }

  // Group by date
  const dayMap = new Map<string, { hits: number; total: number }>();
  for (const pick of picks) {
    const dateStr = cardDateMap.get(pick.card_id);
    if (!dateStr) continue;

    const entry = dayMap.get(dateStr) ?? { hits: 0, total: 0 };
    entry.total += 1;
    if (pick.result === "hit") entry.hits += 1;
    dayMap.set(dateStr, entry);
  }

  // Convert to array, sort by date ascending
  const results: TrendPoint[] = [];
  for (const [date, { hits, total }] of dayMap) {
    results.push({
      date,
      hits,
      total,
      rate: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    });
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

// ---------- Enhanced Analytics (Phase 8) ----------

/**
 * Get hit-rate stats grouped by card size.
 * For each card_size, counts total cards, total picks, total hits, and hit rate.
 */
export async function getCardSizeStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<CardSizeStats[]> {
  const cards = await fetchResolvedCards(supabase, userId, mode, sport);

  const map = new Map<
    number,
    { cards: number; hits: number; total: number }
  >();

  for (const card of cards) {
    const entry = map.get(card.card_size) ?? { cards: 0, hits: 0, total: 0 };
    entry.cards += 1;
    entry.hits += card.score;
    entry.total += card.total_picks;
    map.set(card.card_size, entry);
  }

  const results: CardSizeStats[] = [];
  for (const [cardSize, { cards: cardCount, hits, total }] of map) {
    results.push({
      cardSize,
      cards: cardCount,
      hits,
      total,
      rate: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    });
  }

  results.sort((a, b) => a.cardSize - b.cardSize);
  return results;
}

/**
 * Get hit-rate stats grouped by team (player_team from props).
 */
export async function getTeamStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit: number = 10,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<TeamStats[]> {
  const picks = await fetchResolvedPicks(supabase, userId, mode, sport);

  const map = new Map<string, { hits: number; total: number }>();

  for (const pick of picks) {
    const team = pick.props?.player_team;
    if (!team) continue;

    const entry = map.get(team) ?? { hits: 0, total: 0 };
    entry.total += 1;
    if (pick.result === "hit") entry.hits += 1;
    map.set(team, entry);
  }

  const results: TeamStats[] = [];
  for (const [team, { hits, total }] of map) {
    results.push({
      team,
      hits,
      total,
      rate: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    });
  }

  results.sort((a, b) => b.total - a.total);
  return results.slice(0, limit);
}

/**
 * Get score distribution: for each card_size, count how many cards
 * achieved each possible score (0 through card_size).
 */
export async function getScoreDistribution(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<ScoreDistributionEntry[]> {
  const cards = await fetchResolvedCards(supabase, userId, mode, sport);

  // Group by (cardSize, score) -> count
  const map = new Map<string, number>();

  for (const card of cards) {
    const key = `${card.card_size}:${card.score}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const results: ScoreDistributionEntry[] = [];
  for (const [key, count] of map) {
    const [cardSizeStr, scoreStr] = key.split(":");
    results.push({
      cardSize: Number(cardSizeStr),
      score: Number(scoreStr),
      count,
    });
  }

  // Sort by cardSize ascending, then score ascending
  results.sort(
    (a, b) => a.cardSize - b.cardSize || a.score - b.score
  );
  return results;
}

/**
 * Get average hit-rate stats grouped by game mode.
 */
export async function getGameModeStats(
  supabase: SupabaseClient<Database>,
  userId: string,
  sport?: SportFilter
): Promise<GameModeStats[]> {
  const cards = await fetchResolvedCards(supabase, userId, undefined, sport);

  const map = new Map<
    GameMode,
    { cards: number; hits: number; total: number }
  >();

  for (const card of cards) {
    const entry = map.get(card.game_mode) ?? {
      cards: 0,
      hits: 0,
      total: 0,
    };
    entry.cards += 1;
    entry.hits += card.score;
    entry.total += card.total_picks;
    map.set(card.game_mode, entry);
  }

  const results: GameModeStats[] = [];
  for (const [mode, { cards: cardCount, hits, total }] of map) {
    results.push({
      mode,
      cards: cardCount,
      hits,
      total,
      hitRate: total > 0 ? Math.round((hits / total) * 1000) / 1000 : 0,
    });
  }

  results.sort((a, b) => b.cards - a.cards);
  return results;
}

const CARD_HISTORY_LIMIT = 50;
/** Larger pool when sport filter is active, since filtering happens in JS. */
const CARD_HISTORY_SPORT_POOL = 200;

/**
 * Get the most recent resolved cards for the card history modal.
 * Returns up to 50 cards sorted by resolved_at descending.
 *
 * Pushes ordering and limit to the DB to avoid transferring unbounded data.
 * When a sport filter is active, fetches a larger pool (CARD_HISTORY_SPORT_POOL)
 * since the sport filter is applied client-side via the picks join.
 */
export async function getCardHistory(
  supabase: SupabaseClient<Database>,
  userId: string,
  mode?: ModeFilter,
  sport?: SportFilter
): Promise<CardHistoryItem[]> {
  const dbLimit =
    sport && sport !== "all" ? CARD_HISTORY_SPORT_POOL : CARD_HISTORY_LIMIT;

  let query = (supabase.from("cards") as any)
    .select("id, card_size, game_mode, score, total_picks, resolved_at")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(dbLimit);

  if (mode && mode !== "all") {
    query = query.eq("game_mode", mode);
  }

  const result = await query;

  if (result.error) {
    logError(
      "analytics",
      `getCardHistory: failed to fetch cards: ${result.error.message}`,
      "getCardHistory",
      result.error,
    );
    throw new Error(`Failed to fetch card history: ${result.error.message}`);
  }
  if (!result.data) return [];

  let cards = result.data as ResolvedCardRow[];

  // When a sport filter is active, narrow the pool by checking which cards
  // contain at least one pick whose game.sport matches.
  if (sport && sport !== "all") {
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length === 0) return [];

    const picksResult = await (supabase.from("picks") as any)
      .select("card_id, props:prop_id(games:game_id(sport))")
      .in("card_id", cardIds)
      .in("result", ["hit", "miss"]);

    if (picksResult.error) {
      logError(
        "analytics",
        `getCardHistory: failed to fetch picks for sport filter: ${picksResult.error.message}`,
        "getCardHistory",
        picksResult.error,
      );
      throw new Error(
        `Failed to fetch picks for sport filter: ${picksResult.error.message}`,
      );
    }

    const matchingCardIds = new Set<string>();
    for (const pick of (picksResult.data ?? []) as {
      card_id: string;
      props: { games: { sport: string } | null } | null;
    }[]) {
      if (pick.props?.games?.sport === sport) {
        matchingCardIds.add(pick.card_id);
      }
    }

    cards = cards.filter((c) => matchingCardIds.has(c.id));
  }

  return cards.slice(0, CARD_HISTORY_LIMIT).map((c) => ({
    id: c.id,
    score: c.score,
    totalPicks: c.total_picks,
    cardSize: c.card_size,
    gameMode: c.game_mode,
    resolvedAt: c.resolved_at,
  }));
}

/**
 * Get flame coin balance trend — running balance over time from wagered cards.
 * Returns one point per resolved wagered card, ordered chronologically.
 *
 * Intentionally ignores mode/sport filters — flame coin balance is global.
 * A synthetic starting point at STARTING_BALANCE is prepended and given the
 * same date as the first real data point (so the chart starts at the baseline).
 */
export async function getCoinTrend(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CoinTrendPoint[]> {
  const result = await (supabase.from("cards") as any)
    .select("fire_token_wager, fire_token_payout, resolved_at")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .not("fire_token_wager", "is", null)
    .order("resolved_at", { ascending: true });

  if (result.error) {
    logError("analytics", `getCoinTrend: ${result.error.message}`, "getCoinTrend", result.error);
    return [];
  }
  if (!result.data) return [];

  const cards = result.data as {
    fire_token_wager: number;
    fire_token_payout: number | null;
    resolved_at: string | null;
  }[];

  let balance = STARTING_BALANCE;
  const points: CoinTrendPoint[] = [
    { date: "", balance: STARTING_BALANCE, wager: 0, payout: 0 },
  ];

  for (const card of cards) {
    const wager = card.fire_token_wager;
    const payout = card.fire_token_payout ?? 0;
    balance = balance - wager + payout;
    const date = card.resolved_at?.slice(0, 10) ?? "";
    points.push({ date, balance, wager, payout });
  }

  // Remove the synthetic starting point if we have real data
  if (points.length > 1) {
    points[0].date = points[1].date;
  }

  return points;
}
