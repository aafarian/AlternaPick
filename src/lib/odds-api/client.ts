import {
  ODDS_API_BASE_URL,
  DEFAULT_REGION,
  SPORT_CONFIGS,
  type SportKey,
} from "./constants";
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

export async function fetchEventOdds(
  eventId: string,
  sportKey: SportKey = "nba"
): Promise<{ props: ParsedPlayerProp[]; credits: CreditUsage }> {
  const config = SPORT_CONFIGS[sportKey];
  const marketsParam = config.markets.join(",");
  const url = `${ODDS_API_BASE_URL}/v4/sports/${config.oddsApiKey}/events/${eventId}/odds?apiKey=${getApiKey()}&regions=${DEFAULT_REGION}&markets=${marketsParam}&oddsFormat=american`;

  const response = await fetch(url);
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
        // Binary markets (e.g. anytime goal scorer): name = "Yes", no point → treat as Over 0.5
        const playerName = outcome.description;
        const side = outcome.name;
        const line = outcome.point ?? 0.5;
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
    // Ensure half-point line to avoid pushes (e.g. 18.0 → 18.5)
    if (median % 1 === 0) {
      median += 0.5;
    }
    return { ...base, line: median, bookmaker: "consensus" };
  });
}

export async function fetchAllProps(sportKey: SportKey = "nba"): Promise<FetchPropsResult> {
  const events = await fetchEvents(sportKey);

  // Only fetch odds for games that haven't started yet (saves API credits)
  const now = Date.now();
  const upcomingEvents = events.filter(
    (e) => new Date(e.commence_time).getTime() > now
  );

  const propsMap = new Map<string, ParsedPlayerProp[]>();
  let latestCredits: CreditUsage = { used: null, remaining: null };

  console.log(
    `[Odds API] [${sportKey}] ${events.length} total events, ${upcomingEvents.length} upcoming — fetching odds for upcoming only`
  );

  for (let i = 0; i < upcomingEvents.length; i++) {
    const event = upcomingEvents[i];
    // Throttle: wait 1s between requests to avoid 429 rate limits
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    try {
      const { props, credits } = await fetchEventOdds(event.id, sportKey);
      propsMap.set(event.id, props);
      latestCredits = credits;

      if (
        latestCredits.remaining !== null &&
        latestCredits.remaining < 10
      ) {
        console.warn(
          `[Odds API] Low credits: ${latestCredits.remaining} remaining. Stopping fetch.`
        );
        break;
      }
    } catch (error) {
      console.error(
        `[Odds API] Failed to fetch odds for event ${event.id}:`,
        error
      );
      // Back off on rate limit errors
      if (error instanceof Error && error.message.includes("429")) {
        console.warn(`[Odds API] Rate limited, waiting 5s before continuing...`);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  return { events, props: propsMap, credits: latestCredits };
}

export async function fetchAllPropsMultiSport(): Promise<Map<SportKey, FetchPropsResult>> {
  const results = new Map<SportKey, FetchPropsResult>();
  const sports: SportKey[] = ["nba", "epl", "ncaab", "nhl", "la_liga"];

  const settled = await Promise.allSettled(
    sports.map((sport) => fetchAllProps(sport).then((result) => ({ sport, result })))
  );

  for (const outcome of settled) {
    if (outcome.status === "fulfilled") {
      results.set(outcome.value.sport, outcome.value.result);
    } else {
      console.error(`[Odds API] Failed to fetch props for a sport:`, outcome.reason);
    }
  }

  return results;
}
