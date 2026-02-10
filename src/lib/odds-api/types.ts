import type { StatCategory } from "@/lib/supabase/types";

export interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
}

export interface OddsApiOutcome {
  name: string; // "Over" or "Under"
  description: string; // player name
  price: number; // American odds
  point: number; // the line
}

export interface OddsApiMarket {
  key: string; // e.g. "player_points"
  last_update: string;
  outcomes: OddsApiOutcome[];
}

export interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

export interface OddsApiOddsResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

export interface ParsedPlayerProp {
  player_name: string;
  stat_category: StatCategory;
  line: number;
  over_odds: number | null;
  under_odds: number | null;
  bookmaker: string;
}

export interface CreditUsage {
  used: number | null;
  remaining: number | null;
}

export interface FetchPropsResult {
  events: OddsApiEvent[];
  props: Map<string, ParsedPlayerProp[]>; // eventId -> props
  credits: CreditUsage;
}
