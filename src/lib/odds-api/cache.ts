import { createClient } from "@/lib/supabase/server";
import { CACHE_TTL_MS } from "./constants";
import type { OddsApiEvent, ParsedPlayerProp } from "./types";
import type { Game, Prop } from "@/lib/supabase/types";

export async function isCacheStale(): Promise<boolean> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const gamesResult = await supabase
    .from("games")
    .select("id")
    .gte("commence_time", todayStart.toISOString())
    .lte("commence_time", todayEnd.toISOString());

  const games = (gamesResult.data ?? []) as Pick<Game, "id">[];
  if (games.length === 0) return true;

  const gameIds = games.map((g) => g.id);
  const propsResult = await supabase
    .from("props")
    .select("fetched_at")
    .in("game_id", gameIds)
    .order("fetched_at", { ascending: false })
    .limit(1);

  const props = (propsResult.data ?? []) as Pick<Prop, "fetched_at">[];
  if (props.length === 0) return true;

  const lastFetched = new Date(props[0].fetched_at).getTime();
  return now.getTime() - lastFetched > CACHE_TTL_MS;
}

export async function getCachedProps(): Promise<
  (Game & { props: Prop[] })[] | null
> {
  const supabase = await createClient();

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(now);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
  tomorrowEnd.setHours(11, 59, 59, 999);

  const result = await supabase
    .from("games")
    .select("*, props(*)")
    .gte("commence_time", todayStart.toISOString())
    .lte("commence_time", tomorrowEnd.toISOString())
    .order("commence_time", { ascending: true });

  return result.data as (Game & { props: Prop[] })[] | null;
}

export async function cacheProps(
  events: OddsApiEvent[],
  propsMap: Map<string, ParsedPlayerProp[]>
) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Upsert games
  const gameRows = events
    .filter((e) => propsMap.has(e.id))
    .map((event) => ({
      odds_api_event_id: event.id,
      home_team: event.home_team,
      away_team: event.away_team,
      commence_time: event.commence_time,
    }));

  if (gameRows.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: upsertedGames } = await (supabase.from("games") as any)
    .upsert(gameRows, { onConflict: "odds_api_event_id" })
    .select("id, odds_api_event_id") as {
    data: { id: string; odds_api_event_id: string }[] | null;
  };

  if (!upsertedGames) return;

  const eventToGameId = new Map(
    upsertedGames.map((g) => [g.odds_api_event_id, g.id])
  );

  // Delete stale props for today's games, then insert fresh
  const gameIds = upsertedGames.map((g) => g.id);
  await supabase.from("props").delete().in("game_id", gameIds);

  // Insert all props
  const propRows: {
    game_id: string;
    player_name: string;
    stat_category: string;
    line: number;
    over_odds: number | null;
    under_odds: number | null;
    bookmaker: string | null;
    fetched_at: string;
  }[] = [];

  for (const [eventId, props] of propsMap) {
    const gameId = eventToGameId.get(eventId);
    if (!gameId) continue;

    for (const prop of props) {
      propRows.push({
        game_id: gameId,
        player_name: prop.player_name,
        stat_category: prop.stat_category,
        line: prop.line,
        over_odds: prop.over_odds,
        under_odds: prop.under_odds,
        bookmaker: prop.bookmaker,
        fetched_at: now,
      });
    }
  }

  if (propRows.length > 0) {
    for (let i = 0; i < propRows.length; i += 500) {
      const batch = propRows.slice(i, i + 500);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("props") as any).insert(batch);
    }
  }
}
