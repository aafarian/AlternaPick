import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo, logWarn } from "@/lib/logger";
import {
  ODDS_API_BASE_URL,
  DEFAULT_REGION,
  SPORT_CONFIGS,
  type SportKey,
} from "./constants";
import { SPORT_KEYS } from "@/lib/sports";
import type {
  OddsApiEvent,
  OddsApiOddsResponse,
  ParsedPlayerProp,
  CreditUsage,
  FetchPropsResult,
} from "./types";
import type { StatCategory } from "@/lib/supabase/types";

/** Lightweight call to /v4/sports (costs 0 credits) to read the current credit counters. */
export async function fetchOddsApiCredits(): Promise<Pick<CreditUsage, "remaining" | "used">> {
  try {
    const key = process.env.ODDS_API_KEY;
    if (!key) return { remaining: null, used: null };

    const res = await fetch(`${ODDS_API_BASE_URL}/v4/sports?apiKey=${key}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { remaining: null, used: null };

    return parseCreditHeader(res.headers);
  } catch {
    return { remaining: null, used: null };
  }
}

/** Insert a row into credit_log to record actual API credits consumed during a sync. */
async function logCreditUsage(creditsConsumed: number): Promise<void> {
  if (creditsConsumed <= 0) return;
  const supabase = createAdminClient();
  const { error } = await (supabase.from("credit_log") as any).insert({
    credits_consumed: creditsConsumed,
  });
  if (error) {
    logError("odds-api", "Failed to log credit usage", undefined, error);
  }
}

/**
 * Wraps fetchAllPropsMultiSport with credit tracking:
 * snapshots the API credit counter before and after, then logs the delta.
 */
export async function fetchAllPropsAndLogCredits(
  skipEventIds?: Set<string>,
): Promise<Map<SportKey, FetchPropsResult>> {
  const baseline = await fetchOddsApiCredits();
  const results = await fetchAllPropsMultiSport(skipEventIds);

  const final = await fetchOddsApiCredits();
  if (baseline.used !== null && final.used !== null) {
    const delta = final.used - baseline.used;
    if (delta > 0) {
      await logCreditUsage(delta);
    } else if (delta < 0) {
      logWarn("props-sync", "Credit counter decreased — possible billing cycle reset; skipping credit log");
    }
  }

  return results;
}

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY environment variable is not set");
  return key;
}

function parseCreditHeader(
  headers: Headers
): Pick<CreditUsage, "remaining" | "used"> {
  const remaining = headers.get("x-requests-remaining");
  const used = headers.get("x-requests-used");
  return {
    remaining: remaining ? parseInt(remaining, 10) : null,
    used: used ? parseInt(used, 10) : null,
  };
}

export async function fetchEvents(sportKey: SportKey = "nba"): Promise<OddsApiEvent[]> {
  const config = SPORT_CONFIGS[sportKey];
  const url = `${ODDS_API_BASE_URL}/v4/sports/${config.oddsApiKey}/events?apiKey=${getApiKey()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Odds API events error (${response.status}): ${text}`);
  }

  return response.json();
}

const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 1_500;

export async function fetchEventOdds(
  eventId: string,
  sportKey: SportKey = "nba"
): Promise<{ props: ParsedPlayerProp[]; credits: CreditUsage }> {
  const config = SPORT_CONFIGS[sportKey];
  const marketsParam = config.markets.join(",");
  const url = `${ODDS_API_BASE_URL}/v4/sports/${config.oddsApiKey}/events/${eventId}/odds?apiKey=${getApiKey()}&regions=${DEFAULT_REGION}&markets=${marketsParam}&oddsFormat=american`;

  for (let attempt = 0; attempt <= RATE_LIMIT_RETRIES; attempt++) {
    const response = await fetch(url);

    if (response.status === 429 && attempt < RATE_LIMIT_RETRIES) {
      const delay = RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt;
      logWarn(
        "odds-api",
        `Rate limited on event ${eventId}, retrying in ${delay}ms (attempt ${attempt + 1}/${RATE_LIMIT_RETRIES})`
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Odds API odds error (${response.status}) for event ${eventId}: ${text}`
      );
    }

    const credits = parseCreditHeader(response.headers);
    const data: OddsApiOddsResponse = await response.json();

    const props = parseOddsResponse(data, config.marketToCategory);

    return { props, credits };
  }

  throw new Error(`Odds API rate limited after ${RATE_LIMIT_RETRIES} retries for event ${eventId}`);
}

/** Convert American odds to implied probability (includes vig). */
function impliedProb(american: number | null): number | null {
  if (american == null) return null;
  return american > 0 ? 100 / (american + 100) : -american / (-american + 100);
}

interface LineQuote {
  line: number;
  over: number | null;
  under: number | null;
}

/**
 * Select a single bookmaker's "main" line for a player+stat from its quoted
 * lines.  Bookmakers offer multiple line tiers; we must avoid mixing the
 * primary prop with one-sided "milestone" alternates.
 *
 *  - Two-sided pricing (both Over and Under): the main line is the most
 *    *balanced* one — Over/Under odds closest to even.  This is the line the
 *    book treats as a true coin-flip and is the standard prop.  It correctly
 *    selects e.g. 13.5 for an NBA scorer even when alternate rungs (10.5–16.5)
 *    are also quoted, because alternates have lopsided pricing.
 *  - One-sided pricing only (e.g. home runs, which are quoted as Over-only
 *    "anytime"/"2+"/"3+" milestones): the main line is the *lowest*, i.e. the
 *    base milestone (0.5 = "will they hit one").  Taking the median across
 *    these one-sided rungs is what inflated HR lines to 1.5 and made under
 *    picks a near-guaranteed win.
 */
export function selectMainLine(lines: LineQuote[]): LineQuote | null {
  if (lines.length === 0) return null;

  const imbalance = (l: LineQuote): number => {
    const o = impliedProb(l.over);
    const u = impliedProb(l.under);
    if (o == null || u == null) return Infinity;
    return Math.abs(o - u);
  };

  const twoSided = lines.filter((l) => l.over != null && l.under != null);
  if (twoSided.length > 0) {
    // Most balanced two-sided line; tie-break to the lower line for determinism.
    return twoSided.reduce((best, l) => {
      const di = imbalance(l);
      const db = imbalance(best);
      if (di < db || (di === db && l.line < best.line)) return l;
      return best;
    }, twoSided[0]);
  }

  // One-sided market: the lowest line is the canonical base prop.
  return lines.reduce((lo, l) => (l.line < lo.line ? l : lo), lines[0]);
}

export function parseOddsResponse(
  data: OddsApiOddsResponse,
  marketToCategory: Record<string, StatCategory>
): ParsedPlayerProp[] {
  // Pass 1: collect every quoted line per bookmaker, per player+stat.
  // bookmaker → `${player}|${stat}` → line → { over, under }
  interface PlayerLines {
    player_name: string;
    stat_category: StatCategory;
    lines: Map<number, { over: number | null; under: number | null }>;
  }
  const byBook = new Map<string, Map<string, PlayerLines>>();

  for (const bookmaker of data.bookmakers) {
    for (const market of bookmaker.markets) {
      const statCategory = marketToCategory[market.key];
      if (!statCategory) continue;

      let playerMap = byBook.get(bookmaker.key);
      if (!playerMap) {
        playerMap = new Map();
        byBook.set(bookmaker.key, playerMap);
      }

      for (const outcome of market.outcomes) {
        // Odds API: name = "Over"/"Under", description = player name.
        // Anytime markets use "Yes"/"No" with no point value (default 0.5).
        const playerName = outcome.description;
        const side = outcome.name;
        const line = outcome.point ?? 0.5;
        const key = `${playerName}|${statCategory}`;

        let entry = playerMap.get(key);
        if (!entry) {
          entry = { player_name: playerName, stat_category: statCategory, lines: new Map() };
          playerMap.set(key, entry);
        }
        let sides = entry.lines.get(line);
        if (!sides) {
          sides = { over: null, under: null };
          entry.lines.set(line, sides);
        }
        if (side === "Over" || side === "Yes") {
          sides.over = outcome.price;
        } else if (side === "Under" || side === "No") {
          sides.under = outcome.price;
        }
      }
    }
  }

  // Pass 2: pick each bookmaker's main line, grouped by player+stat.
  const mainByPlayer = new Map<string, ParsedPlayerProp[]>();
  for (const [bookKey, playerMap] of byBook) {
    for (const [key, entry] of playerMap) {
      const quotes: LineQuote[] = Array.from(entry.lines.entries()).map(
        ([line, s]) => ({ line, over: s.over, under: s.under })
      );
      const main = selectMainLine(quotes);
      if (!main) continue;

      const arr = mainByPlayer.get(key) ?? [];
      arr.push({
        player_name: entry.player_name,
        stat_category: entry.stat_category,
        line: main.line,
        over_odds: main.over,
        under_odds: main.under,
        bookmaker: bookKey,
      });
      mainByPlayer.set(key, arr);
    }
  }

  // Pass 3: consensus = median of per-book main lines. Odds are carried from
  // the book whose main line is closest to the consensus, keeping line+odds
  // consistent.
  const result: ParsedPlayerProp[] = [];
  for (const props of mainByPlayer.values()) {
    const lines = props.map((p) => p.line).sort((a, b) => a - b);
    const mid = Math.floor(lines.length / 2);
    const consensusLine =
      lines.length % 2 === 0 ? (lines[mid - 1] + lines[mid]) / 2 : lines[mid];

    const rep = props.reduce(
      (best, p) =>
        Math.abs(p.line - consensusLine) < Math.abs(best.line - consensusLine)
          ? p
          : best,
      props[0]
    );

    result.push({
      player_name: rep.player_name,
      stat_category: rep.stat_category,
      line: consensusLine,
      over_odds: rep.over_odds,
      under_odds: rep.under_odds,
      bookmaker: "consensus",
    });
  }
  return result;
}

export async function fetchAllProps(
  sportKey: SportKey = "nba",
  skipEventIds?: Set<string>,
): Promise<FetchPropsResult> {
  const events = await fetchEvents(sportKey);

  // Only fetch odds for games starting within the next 48 hours.
  // Props are rarely available earlier, so calling the API for games further
  // out wastes credits (each call costs 1 credit per market requested).
  const now = Date.now();
  const ODDS_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours
  const upcomingEvents = events.filter((e) => {
    const start = new Date(e.commence_time).getTime();
    return start > now && start < now + ODDS_WINDOW_MS;
  });

  // Skip events that already have props in the DB to save credits
  const newEvents = skipEventIds
    ? upcomingEvents.filter((e) => !skipEventIds.has(e.id))
    : upcomingEvents;

  const propsMap = new Map<string, ParsedPlayerProp[]>();
  let latestCredits: CreditUsage = { used: null, remaining: null };

  logInfo(
    "odds-api",
    `[${sportKey}] ${events.length} total, ${upcomingEvents.length} within 48h, ${newEvents.length} new — fetching odds`
  );

  for (let i = 0; i < newEvents.length; i++) {
    const event = newEvents[i];
    // Small delay between requests to avoid rate limiting
    if (i > 0) await new Promise((r) => setTimeout(r, 300));

    try {
      const { props, credits } = await fetchEventOdds(event.id, sportKey);
      propsMap.set(event.id, props);
      latestCredits = credits;

      if (
        latestCredits.remaining !== null &&
        latestCredits.remaining < 10
      ) {
        logWarn(
          "odds-api",
          `Low credits: ${latestCredits.remaining} remaining. Stopping fetch.`
        );
        break;
      }
    } catch (error) {
      logError(
        "odds-api",
        `Failed to fetch odds for event ${event.id}`,
        undefined,
        error
      );
    }
  }

  return { events, props: propsMap, credits: latestCredits };
}

export async function fetchAllPropsMultiSport(
  skipEventIds?: Set<string>,
): Promise<Map<SportKey, FetchPropsResult>> {
  const results = new Map<SportKey, FetchPropsResult>();
  // NHL is not yet wired into the frontend — skip to save API credits
  const sports: SportKey[] = SPORT_KEYS.filter((s) => s !== "nhl");

  // Fetch sports sequentially to avoid rate-limiting from concurrent requests
  for (const sport of sports) {
    try {
      const result = await fetchAllProps(sport, skipEventIds);
      results.set(sport, result);
    } catch (error) {
      logError("odds-api", `Failed to fetch props for ${sport}`, undefined, error);
    }
  }

  return results;
}
