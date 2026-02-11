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
import type { Database, StatCategory } from "@/lib/supabase/types";
import type {
  CategoryStats,
  PlayerStats,
  DirectionStats,
  TrendPoint,
} from "./types";

// ---------- Internal helpers ----------

/** Row shape returned by the pick + prop + card join */
interface ResolvedPickRow {
  selection: "over" | "under";
  result: "hit" | "miss";
  cards: { user_id: string | null; resolved_at: string | null } | null;
  props: { stat_category: StatCategory; player_name: string } | null;
}

/**
 * Fetch all resolved picks for a user. Because Supabase PostgREST cannot
 * filter on a joined column (cards.user_id) efficiently, we first grab the
 * user's resolved card IDs then fetch picks matching those card IDs.
 */
async function fetchResolvedPicks(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ResolvedPickRow[]> {
  // Step 1 – get card IDs belonging to this user that are resolved
  const cardsResult = await (supabase.from("cards") as any)
    .select("id")
    .eq("user_id", userId)
    .eq("status", "resolved");

  if (cardsResult.error || !cardsResult.data) return [];

  const cardIds = (cardsResult.data as { id: string }[]).map((c) => c.id);
  if (cardIds.length === 0) return [];

  // Step 2 – get resolved picks for those cards with prop join
  const picksResult = await (supabase.from("picks") as any)
    .select(
      "selection, result, cards:card_id(user_id, resolved_at), props:prop_id(stat_category, player_name)"
    )
    .in("card_id", cardIds)
    .in("result", ["hit", "miss"]);

  if (picksResult.error || !picksResult.data) return [];

  return picksResult.data as ResolvedPickRow[];
}

// ---------- Public query functions ----------

/**
 * Get hit-rate stats grouped by stat category.
 */
export async function getCategoryStats(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CategoryStats[]> {
  const picks = await fetchResolvedPicks(supabase, userId);

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
  limit: number = 10
): Promise<PlayerStats[]> {
  const picks = await fetchResolvedPicks(supabase, userId);

  const map = new Map<string, { hits: number; total: number }>();

  for (const pick of picks) {
    const name = pick.props?.player_name;
    if (!name) continue;

    const entry = map.get(name) ?? { hits: 0, total: 0 };
    entry.total += 1;
    if (pick.result === "hit") entry.hits += 1;
    map.set(name, entry);
  }

  const results: PlayerStats[] = [];
  for (const [player_name, { hits, total }] of map) {
    results.push({
      player_name,
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
  userId: string
): Promise<DirectionStats> {
  const picks = await fetchResolvedPicks(supabase, userId);

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
  days: number = 30
): Promise<TrendPoint[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffISO = cutoff.toISOString();

  // Step 1 – get resolved cards in the date range
  const cardsResult = await (supabase.from("cards") as any)
    .select("id, resolved_at")
    .eq("user_id", userId)
    .eq("status", "resolved")
    .gte("resolved_at", cutoffISO);

  if (cardsResult.error || !cardsResult.data) return [];

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

  // Step 2 – get resolved picks for those cards
  const picksResult = await (supabase.from("picks") as any)
    .select("card_id, result")
    .in("card_id", cardIds)
    .in("result", ["hit", "miss"]);

  if (picksResult.error || !picksResult.data) return [];

  const picks = picksResult.data as {
    card_id: string;
    result: "hit" | "miss";
  }[];

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
