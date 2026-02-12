import {
  ODDS_API_BASE_URL,
  SPORT_KEY,
  DEFAULT_REGION,
  MARKETS,
  MARKET_TO_STAT_CATEGORY,
  type MarketKey,
} from "./constants";
import type {
  OddsApiEvent,
  OddsApiOddsResponse,
  ParsedPlayerProp,
  CreditUsage,
  FetchPropsResult,
} from "./types";

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

export async function fetchEvents(): Promise<OddsApiEvent[]> {
  const url = `${ODDS_API_BASE_URL}/v4/sports/${SPORT_KEY}/events?apiKey=${getApiKey()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Odds API events error (${response.status}): ${text}`);
  }

  return response.json();
}

export async function fetchEventOdds(
  eventId: string,
  markets: readonly string[] = MARKETS
): Promise<{ props: ParsedPlayerProp[]; credits: CreditUsage }> {
  const marketsParam = markets.join(",");
  const url = `${ODDS_API_BASE_URL}/v4/sports/${SPORT_KEY}/events/${eventId}/odds?apiKey=${getApiKey()}&regions=${DEFAULT_REGION}&markets=${marketsParam}&oddsFormat=american`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Odds API odds error (${response.status}) for event ${eventId}: ${text}`
    );
  }

  const credits = parseCreditHeader(response.headers);
  const data: OddsApiOddsResponse = await response.json();

  const props = parseOddsResponse(data);

  return { props, credits };
}

function parseOddsResponse(data: OddsApiOddsResponse): ParsedPlayerProp[] {
  // Use a map to deduplicate: keep first bookmaker's line per player+stat combo
  const dedupMap = new Map<string, ParsedPlayerProp>();

  for (const bookmaker of data.bookmakers) {
    for (const market of bookmaker.markets) {
      const statCategory =
        MARKET_TO_STAT_CATEGORY[market.key as MarketKey];
      if (!statCategory) continue;

      // Group outcomes by player (Over + Under pairs)
      const playerOutcomes = new Map<
        string,
        { over_odds: number | null; under_odds: number | null; line: number }
      >();

      for (const outcome of market.outcomes) {
        // Odds API: name = "Over"/"Under", description = player name
        const playerName = outcome.description;
        const side = outcome.name;
        const key = `${playerName}_${outcome.point}`;
        const existing = playerOutcomes.get(key) || {
          over_odds: null,
          under_odds: null,
          line: outcome.point,
        };

        if (side === "Over") {
          existing.over_odds = outcome.price;
        } else if (side === "Under") {
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

export async function fetchAllProps(): Promise<FetchPropsResult> {
  const events = await fetchEvents();

  // Only fetch odds for games that haven't started yet (saves API credits)
  const now = Date.now();
  const upcomingEvents = events.filter(
    (e) => new Date(e.commence_time).getTime() > now
  );

  const propsMap = new Map<string, ParsedPlayerProp[]>();
  let latestCredits: CreditUsage = { used: null, remaining: null };

  console.log(
    `[Odds API] ${events.length} total events, ${upcomingEvents.length} upcoming — fetching odds for upcoming only`
  );

  for (const event of upcomingEvents) {
    try {
      const { props, credits } = await fetchEventOdds(event.id);
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
    }
  }

  return { events, props: propsMap, credits: latestCredits };
}
