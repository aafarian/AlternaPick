import type { PlayerBoxScore, StatsGame } from "@/lib/stats-service/client";
import type { PickWithPropAndGame } from "../live-computation";

export function makePlayer(overrides: Partial<PlayerBoxScore> = {}): PlayerBoxScore {
  return {
    player_name: "LeBron James",
    player_id: "2544",
    team: "Los Angeles Lakers",
    team_tricode: "LAL",
    minutes: "36:00",
    points: 28,
    rebounds: 8,
    offensive_rebounds: 2,
    defensive_rebounds: 6,
    assists: 10,
    steals: 2,
    blocks: 1,
    turnovers: 3,
    threes_made: 4,
    threes_attempted: 8,
    field_goals_made: 10,
    field_goals_attempted: 20,
    free_throws_made: 4,
    free_throws_attempted: 5,
    plus_minus: 12,
    fouls: 2,
    ...overrides,
  };
}

export function makeGame(overrides: Partial<StatsGame> = {}): StatsGame {
  return {
    game_id: "401584700",
    home_team: "Los Angeles Lakers",
    home_tricode: "LAL",
    away_team: "Boston Celtics",
    away_tricode: "BOS",
    home_score: 95,
    away_score: 88,
    status: "live",
    period: 3,
    clock: "5:30",
    start_time: "2026-03-03T00:00:00Z",
    ...overrides,
  };
}

export function makePick(overrides: Partial<PickWithPropAndGame> = {}): PickWithPropAndGame {
  return {
    id: "pick-1",
    selection: "over",
    props: {
      player_name: "LeBron James",
      player_id: "2544",
      player_team: "Los Angeles Lakers",
      player_position: "SF",
      stat_category: "points",
      line: 25.5,
      game_id: "game-1",
      games: {
        external_event_id: "401584700",
        sport: "nba",
        status: "scheduled",
        home_team: "Los Angeles Lakers",
        away_team: "Boston Celtics",
        home_score: null,
        away_score: null,
        commence_time: "2026-03-03T00:00:00Z",
      },
    },
    ...overrides,
  };
}
