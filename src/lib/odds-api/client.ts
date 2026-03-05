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

function parseOddsResponse(
  data: OddsApiOddsResponse,
  marketToCategory: Record<string, StatCategory>
): ParsedPlayerProp[] {
  // Use a map to deduplicate: keep first bookmaker's line per player+stat combo
  const dedupMap = new Map<string, ParsedPlayerProp>();

  for (const bookmaker of data.bookmakers) {
    for (const market of bookmaker.markets) {
      const statCategory = marketToCategory[market.key];
      if (!statCategory) continue;

      // Group outcomes by player (Over + Under pairs)
      const playerOutcomes = new Map<
        string,
        { over_odds: number | null; under_odds: number | null; line: number }
      >();

      for (const outcome of market.outcomes) {
        // Odds API: name = "Over"/"Under", description = player name
        // Anytime goalscorer markets use "Yes"/"No" with no point value
        const playerName = outcome.description;
        const side = outcome.name;
        const line = outcome.point ?? 0.5; // Default 0.5 for anytime markets (score ≥1)
        const key = `${playerName}_${line}`;
        const existing = playerOutcomes.get(key) || {
          over_odds: null,
          under_odds: null,
          line,
        };

        if (side === "Over" || side === "Yes") {
          existing.over_odds = outcome.price;
        } else if (side === "Under" || side === "No") {
          existing.under_odds = outcome.price;
        }

        playerOutcomes.set(key, existing);
      }

      for (const [key, data] of playerOutcomes) {
        const playerName = key.substring(0, key.lastIndexOf("_"));
        const dedupKey = `${playerName}_${statCategory}_${data.line}`;
        if (!dedupMap.has(dedupKey)) {
          dedupMap.set(dedupKey, {
            player_name: playerName,
            stat_category: statCategory,
            line: data.line,
            over_odds: data.over_odds,
            under_odds: data.under_odds,
            bookmaker: bookmaker.key,
          });
        }
      }
    }
  }

  // Second pass: collapse multiple bookmaker lines into one consensus (median) per player+stat
  const consensusMap = new Map<
    string,
    { lines: number[]; base: ParsedPlayerProp }
  >();
  for (const prop of dedupMap.values()) {
    const key = `${prop.player_name}_${prop.stat_category}`;
    const existing = consensusMap.get(key);
    if (existing) {
      existing.lines.push(prop.line);
    } else {
      consensusMap.set(key, { lines: [prop.line], base: prop });
    }
  }

  return Array.from(consensusMap.values()).map(({ lines, base }) => {
    lines.sort((a, b) => a - b);
    const mid = Math.floor(lines.length / 2);
    let median =
      lines.length % 2 === 0
        ? (lines[mid - 1] + lines[mid]) / 2
        : lines[mid];
    // Snap to nearest half-point line to avoid pushes and quarter lines
    // e.g. 1.75 → 1.5, 2.25 → 2.5, 18.0 → 18.5
    median = Math.floor(median) + 0.5;
    return { ...base, line: median, bookmaker: "consensus" };
  });
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
  const sports: SportKey[] = [...SPORT_KEYS];

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
