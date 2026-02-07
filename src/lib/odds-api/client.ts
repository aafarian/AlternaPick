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
  const props: ParsedPlayerProp[] = [];

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
        const key = `${outcome.name}_${outcome.point}`;
        const existing = playerOutcomes.get(key) || {
          over_odds: null,
          under_odds: null,
          line: outcome.point,
        };

        if (outcome.description === "Over") {
          existing.over_odds = outcome.price;
        } else if (outcome.description === "Under") {
          existing.under_odds = outcome.price;
        }

        playerOutcomes.set(key, existing);
      }

      for (const [key, data] of playerOutcomes) {
        const playerName = key.substring(0, key.lastIndexOf("_"));
        props.push({
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

  return props;
}

export async function fetchAllProps(): Promise<FetchPropsResult> {
  const events = await fetchEvents();

  const propsMap = new Map<string, ParsedPlayerProp[]>();
  let latestCredits: CreditUsage = { used: null, remaining: null };

  for (const event of events) {
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
