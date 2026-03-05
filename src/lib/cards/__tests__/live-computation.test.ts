import { describe, it, expect, vi } from "vitest";
import { buildLivePicksForCard, type PickWithPropAndGame } from "../live-computation";
import { toLivePickData } from "../live-types";
import type { StatsGame, PlayerBoxScore } from "@/lib/stats-service/client";
import { makePlayer, makeGame, makePick } from "./factories";

// Mock constants — teamLogoUrl, teamTricode, gameUrl
vi.mock("@/lib/constants", () => ({
  teamLogoUrl: vi.fn((name: string) => (name ? `logo:${name}` : "")),
  teamTricode: vi.fn((name: string) => name.slice(0, 3).toUpperCase()),
  gameUrl: vi.fn(
    (sport: string | undefined, id: string) =>
      id ? `https://example.com/${sport}/${id}` : undefined,
  ),
  registerNcaabTeamIds: vi.fn(),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
}));

/* ---------- tests ---------- */

describe("buildLivePicksForCard", () => {
  describe("game state transitions", () => {
    it("pre-game: pick with no live data uses DB status 'scheduled'", () => {
      const pick = makePick();
      const gameStatusMap = new Map<string, StatsGame>();
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks).toHaveLength(1);
      expect(result.livePicks[0].game_status?.status).toBe("scheduled");
      expect(result.livePicks[0].current_value).toBeNull();
      expect(result.livePicks[0].trending).toBeNull();
      expect(result.hasLiveGames).toBe(false);
    });

    it("pre-game: DB status defaults to 'scheduled' when null", () => {
      const pick = makePick();
      pick.props.games.status = null;
      const gameStatusMap = new Map<string, StatsGame>();
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.status).toBe("scheduled");
    });

    it("live game: uses stats service data, sets hasLiveGames", () => {
      const pick = makePick();
      const game = makeGame({ status: "live", period: 3, clock: "5:30" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.status).toBe("live");
      expect(result.livePicks[0].game_status?.period).toBe(3);
      expect(result.livePicks[0].game_status?.clock).toBe("5:30");
      expect(result.hasLiveGames).toBe(true);
    });

    it("final game: uses stats service data, no hasLiveGames", () => {
      const pick = makePick();
      const game = makeGame({ status: "final" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.status).toBe("final");
      expect(result.hasLiveGames).toBe(false);
    });
  });

  describe("team fallback matching", () => {
    it("matches game by external_event_id", () => {
      const pick = makePick();
      const game = makeGame();
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.home_team).toBe("Los Angeles Lakers");
      expect(result.livePicks[0].game_status?.away_team).toBe("Boston Celtics");
    });

    it("falls back to team name matching when external_event_id is null", () => {
      const pick = makePick();
      pick.props.games.external_event_id = null;
      const game = makeGame();
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      // Should find the game via home|away team name lookup
      expect(result.livePicks[0].game_status?.status).toBe("live");
      expect(result.livePicks[0].game_status?.home_team).toBe("Los Angeles Lakers");
    });

    it("does not match when teams don't align and no external_event_id", () => {
      const pick = makePick();
      pick.props.games.external_event_id = null;
      pick.props.games.home_team = "Phoenix Suns";
      pick.props.games.away_team = "Miami Heat";
      const game = makeGame();
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      // Falls back to DB status since team names don't match
      expect(result.livePicks[0].game_status?.status).toBe("scheduled");
    });
  });

  describe("value computation — boxscore hit/miss/push", () => {
    it("over pick hitting: value > line -> trending='hit'", () => {
      const pick = makePick({ selection: "over" });
      pick.props.line = 25.5;
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(28);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("over pick missing: value < line -> trending='miss'", () => {
      const pick = makePick({ selection: "over" });
      pick.props.line = 30.5;
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(28);
      expect(result.livePicks[0].trending).toBe("miss");
    });

    it("under pick hitting: value < line -> trending='hit'", () => {
      const pick = makePick({ selection: "under" });
      pick.props.line = 30.5;
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(28);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("under pick missing: value > line -> trending='miss'", () => {
      const pick = makePick({ selection: "under" });
      pick.props.line = 25.5;
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(28);
      expect(result.livePicks[0].trending).toBe("miss");
    });

    it("push: value exactly equals line -> trending='push'", () => {
      const pick = makePick({ selection: "over" });
      pick.props.line = 28;
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(28);
      expect(result.livePicks[0].trending).toBe("push");
    });
  });

  describe("DNP handling", () => {
    it("pick with result='dnp' on final game -> trending='dnp', skips boxscore", () => {
      const pick = makePick({
        result: "dnp",
        props: {
          ...makePick().props,
          games: { ...makePick().props.games, status: "final" },
        },
      });
      const game = makeGame({ status: "final" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].trending).toBe("dnp");
      // DNP skips boxscore — current_value stays null
      expect(result.livePicks[0].current_value).toBeNull();
    });

    it("pick with result='dnp' on live game -> no DNP trending", () => {
      const pick = makePick({
        result: "dnp",
        props: {
          ...makePick().props,
          games: { ...makePick().props.games, status: "live" },
        },
      });
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      // During live games, DNP result is ignored — player might still enter
      expect(result.livePicks[0].trending).not.toBe("dnp");
      expect(result.livePicks[0].current_value).toBe(28);
    });

    it("player with dnp flag in boxscore on final game -> trending='dnp'", () => {
      const pick = makePick();
      const game = makeGame({ status: "final" });
      const player = makePlayer({ player_name: "LeBron James", dnp: true });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].trending).toBe("dnp");
    });

    it("player with dnp flag in boxscore on live game -> no DNP trending", () => {
      const pick = makePick();
      const game = makeGame({ status: "live" });
      const player = makePlayer({ player_name: "LeBron James", dnp: true });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      // During live games, bench players with DNP flag just haven't entered yet
      expect(result.livePicks[0].trending).toBeNull();
    });
  });

  describe("value preservation / fallbacks", () => {
    it("falls back to actual_value from DB when boxscore unavailable", () => {
      const pick = makePick({ actual_value: 32, result: "hit" });
      const game = makeGame({ status: "final" });
      const gameStatusMap = new Map([["401584700", game]]);
      // No boxscore data for this game
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(32);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("falls back to actual_value when player not in boxscore", () => {
      const pick = makePick({ actual_value: 32, result: "hit" });
      const game = makeGame({ status: "final" });
      // Boxscore has different player
      const otherPlayer = makePlayer({ player_name: "Anthony Davis" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [otherPlayer]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBe(32);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("uses result for trending even without actual_value (second fallback)", () => {
      const pick = makePick({ result: "miss", actual_value: null });
      const game = makeGame({ status: "final" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBeNull();
      expect(result.livePicks[0].trending).toBe("miss");
    });

    it("uses result='push' for trending without actual_value", () => {
      const pick = makePick({ result: "push", actual_value: null });
      const game = makeGame({ status: "final" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].trending).toBe("push");
    });

    it("scheduled game does not compute trending even with actual_value", () => {
      const pick = makePick({ actual_value: 32 });
      // No game in status map -> falls back to DB which is "scheduled"
      const gameStatusMap = new Map<string, StatsGame>();
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].current_value).toBeNull();
      expect(result.livePicks[0].trending).toBeNull();
    });
  });

  describe("sport-specific handling", () => {
    it("NCAAB game: propagates sport and period from live data", () => {
      const pick = makePick();
      pick.props.games.sport = "ncaab";
      pick.props.games.external_event_id = "401700001";
      const game = makeGame({
        game_id: "401700001",
        status: "live",
        period: 2,
        clock: "12:00",
        home_team: "Duke Blue Devils",
        away_team: "North Carolina Tar Heels",
        home_tricode: "DUKE",
        away_tricode: "UNC",
      });
      const gameStatusMap = new Map([["401700001", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.sport).toBe("ncaab");
      expect(result.livePicks[0].game_status?.period).toBe(2);
      expect(result.livePicks[0].game_status?.clock).toBe("12:00");
      expect(result.livePicks[0].sport).toBe("ncaab");
    });

    it("soccer (EPL) game: propagates sport and period from live data", () => {
      const pick = makePick();
      pick.props.games.sport = "epl";
      pick.props.games.external_event_id = "epl-match-1";
      pick.props.player_name = "Mohamed Salah";
      pick.props.stat_category = "shots";
      pick.props.line = 3.5;
      const game = makeGame({
        game_id: "epl-match-1",
        status: "live",
        period: 2,
        clock: "65:00",
        home_team: "Liverpool",
        away_team: "Arsenal",
        home_tricode: "LIV",
        away_tricode: "ARS",
      });
      const player = makePlayer({
        player_name: "Mohamed Salah",
        shots: 4,
      });
      const gameStatusMap = new Map([["epl-match-1", game]]);
      const boxscoreMap = new Map([["epl-match-1", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.sport).toBe("epl");
      expect(result.livePicks[0].game_status?.period).toBe(2);
      expect(result.livePicks[0].current_value).toBe(4);
      expect(result.livePicks[0].trending).toBe("hit"); // 4 > 3.5 for over
    });

    it("La Liga game: handled like EPL with correct sport", () => {
      const pick = makePick();
      pick.props.games.sport = "la_liga";
      pick.props.games.external_event_id = "laliga-match-1";
      const game = makeGame({
        game_id: "laliga-match-1",
        status: "live",
        period: 1,
        clock: "30:00",
      });
      const gameStatusMap = new Map([["laliga-match-1", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.sport).toBe("la_liga");
    });
  });

  describe("games deduplication", () => {
    it("multiple picks for same game -> game appears once in games list", () => {
      const pick1 = makePick({ id: "pick-1" });
      const pick2 = makePick({ id: "pick-2" });
      pick2.props.player_name = "Anthony Davis";
      pick2.props.stat_category = "rebounds";
      pick2.props.line = 10.5;

      const game = makeGame({ status: "live" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick1, pick2], gameStatusMap, boxscoreMap);

      expect(result.livePicks).toHaveLength(2);
      expect(result.games).toHaveLength(1);
      expect(result.games[0].external_event_id).toBe("401584700");
    });

    it("picks for different games -> both games in list", () => {
      const pick1 = makePick({ id: "pick-1" });
      const pick2 = makePick({ id: "pick-2" });
      pick2.props.games.external_event_id = "401584701";
      pick2.props.game_id = "game-2";

      const game1 = makeGame({ game_id: "401584700", status: "live" });
      const game2 = makeGame({
        game_id: "401584701",
        status: "final",
        home_team: "Miami Heat",
        away_team: "Chicago Bulls",
      });
      const gameStatusMap = new Map([
        ["401584700", game1],
        ["401584701", game2],
      ]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick1, pick2], gameStatusMap, boxscoreMap);

      expect(result.games).toHaveLength(2);
    });
  });

  describe("isFullyResolved (hasLiveGames)", () => {
    it("all picks final with no live games -> hasLiveGames is false", () => {
      const pick = makePick({ result: "hit", actual_value: 30 });
      const game = makeGame({ status: "final" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.hasLiveGames).toBe(false);
    });

    it("at least one live game -> hasLiveGames is true", () => {
      const pick1 = makePick({ id: "pick-1" });
      const pick2 = makePick({ id: "pick-2" });
      pick2.props.games.external_event_id = "401584701";
      pick2.props.game_id = "game-2";

      const game1 = makeGame({ game_id: "401584700", status: "live" });
      const game2 = makeGame({ game_id: "401584701", status: "final" });
      const gameStatusMap = new Map([
        ["401584700", game1],
        ["401584701", game2],
      ]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick1, pick2], gameStatusMap, boxscoreMap);

      expect(result.hasLiveGames).toBe(true);
    });
  });

  describe("live pick data shape", () => {
    it("populates all LivePickData fields correctly", () => {
      const pick = makePick();
      const game = makeGame({ status: "live" });
      const player = makePlayer({ points: 28 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [player]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);
      const lp = result.livePicks[0];

      expect(lp.pick_id).toBe("pick-1");
      expect(lp.player_name).toBe("LeBron James");
      expect(lp.player_id).toBe("2544");
      expect(lp.player_team).toBe("Los Angeles Lakers");
      expect(lp.player_position).toBe("SF");
      expect(lp.sport).toBe("nba");
      expect(lp.stat_category).toBe("points");
      expect(lp.line).toBe(25.5);
      expect(lp.selection).toBe("over");
      expect(lp.current_value).toBe(28);
      expect(lp.trending).toBe("hit");
      expect(lp.game_status).not.toBeNull();
    });

    it("game status includes scores from stats service", () => {
      const pick = makePick();
      const game = makeGame({ status: "live", home_score: 95, away_score: 88 });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);
      const gs = result.livePicks[0].game_status!;

      expect(gs.home_score).toBe(95);
      expect(gs.away_score).toBe(88);
    });

    it("DB fallback game status uses DB scores", () => {
      const pick = makePick();
      pick.props.games.home_score = 102;
      pick.props.games.away_score = 99;
      const gameStatusMap = new Map<string, StatsGame>();
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);
      const gs = result.livePicks[0].game_status!;

      expect(gs.home_score).toBe(102);
      expect(gs.away_score).toBe(99);
    });
  });

  describe("edge cases", () => {
    it("empty picks array returns empty results", () => {
      const result = buildLivePicksForCard(
        [],
        new Map<string, StatsGame>(),
        new Map<string, PlayerBoxScore[]>(),
      );

      expect(result.livePicks).toHaveLength(0);
      expect(result.games).toHaveLength(0);
      expect(result.hasLiveGames).toBe(false);
    });

    it("pick with no games object fields still works", () => {
      const pick: PickWithPropAndGame = {
        id: "pick-sparse",
        selection: "over",
        props: {
          player_name: "Player X",
          player_id: null,
          stat_category: "points",
          line: 20,
          game_id: "game-sparse",
          games: {
            external_event_id: null,
            sport: null,
            status: null,
            home_team: null,
            away_team: null,
            home_score: null,
            away_score: null,
            commence_time: null,
          },
        },
      };

      const result = buildLivePicksForCard(
        [pick],
        new Map<string, StatsGame>(),
        new Map<string, PlayerBoxScore[]>(),
      );

      expect(result.livePicks).toHaveLength(1);
      expect(result.livePicks[0].game_status?.status).toBe("scheduled");
    });

    it("boxscore with empty array does not crash", () => {
      const pick = makePick();
      const game = makeGame({ status: "live" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map([["401584700", [] as PlayerBoxScore[]]]);

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      // No player found in empty boxscore -> null current_value, null trending
      expect(result.livePicks[0].current_value).toBeNull();
      expect(result.livePicks[0].trending).toBeNull();
    });

    it("game in DB marked 'final' but not in stats service uses DB status", () => {
      const pick = makePick();
      pick.props.games.status = "final";
      pick.props.games.home_score = 110;
      pick.props.games.away_score = 105;
      pick.actual_value = 35;
      pick.result = "hit";
      const gameStatusMap = new Map<string, StatsGame>();
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.status).toBe("final");
      expect(result.livePicks[0].current_value).toBe(35);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("game in DB marked 'live' but not in stats service uses DB status", () => {
      const pick = makePick();
      pick.props.games.status = "live";
      const gameStatusMap = new Map<string, StatsGame>();
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      // effectiveStatus will be "live" from DB, so it tries boxscore lookup
      expect(result.livePicks[0].game_status?.status).toBe("live");
    });

    it("commence_time from stats service start_time takes priority", () => {
      const pick = makePick();
      pick.props.games.commence_time = "2026-03-03T01:00:00Z";
      const game = makeGame({
        status: "scheduled",
        start_time: "2026-03-03T00:30:00Z",
      });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.commence_time).toBe("2026-03-03T00:30:00Z");
    });

    it("commence_time falls back to DB when stats service has empty start_time", () => {
      const pick = makePick();
      pick.props.games.commence_time = "2026-03-03T01:00:00Z";
      const game = makeGame({ status: "scheduled", start_time: "" });
      const gameStatusMap = new Map([["401584700", game]]);
      const boxscoreMap = new Map<string, PlayerBoxScore[]>();

      const result = buildLivePicksForCard([pick], gameStatusMap, boxscoreMap);

      expect(result.livePicks[0].game_status?.commence_time).toBe("2026-03-03T01:00:00Z");
    });
  });

  describe("sport lifecycle scenarios", () => {
    describe("NBA lifecycle", () => {
      const eventId = "401584800";

      it("scheduled: no live data -> status=scheduled, no value", () => {
        const pick = makePick();
        pick.props.games.external_event_id = eventId;
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].game_status?.status).toBe("scheduled");
        expect(result.livePicks[0].current_value).toBeNull();
        expect(result.livePicks[0].trending).toBeNull();
      });

      it("live with boxscore: correct value and trending", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.external_event_id = eventId;
        pick.props.stat_category = "points";
        pick.props.line = 25.5;
        const game = makeGame({ game_id: eventId, status: "live", period: 3, clock: "PT05M30.00S" });
        const player = makePlayer({ player_name: "LeBron James", points: 28 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].game_status?.status).toBe("live");
        expect(result.livePicks[0].current_value).toBe(28);
        expect(result.livePicks[0].trending).toBe("hit");
        expect(result.hasLiveGames).toBe(true);
      });

      it("final with boxscore: correct value, no hasLiveGames", () => {
        const pick = makePick({ selection: "under" });
        pick.props.games.external_event_id = eventId;
        pick.props.stat_category = "rebounds";
        pick.props.line = 10.5;
        const game = makeGame({ game_id: eventId, status: "final", period: 4, clock: "0:00" });
        const player = makePlayer({ player_name: "LeBron James", rebounds: 8 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].game_status?.status).toBe("final");
        expect(result.livePicks[0].current_value).toBe(8);
        expect(result.livePicks[0].trending).toBe("hit"); // 8 < 10.5 under
        expect(result.hasLiveGames).toBe(false);
      });

      it("DB fallback when final: uses stored actual_value", () => {
        const pick = makePick({ actual_value: 30, result: "hit" });
        pick.props.games.external_event_id = eventId;
        pick.props.games.status = "final";
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].game_status?.status).toBe("final");
        expect(result.livePicks[0].current_value).toBe(30);
        expect(result.livePicks[0].trending).toBe("hit");
      });
    });

    describe("NCAAB lifecycle", () => {
      const eventId = "401700100";

      it("scheduled: no live data -> status=scheduled", () => {
        const pick = makePick();
        pick.props.games.sport = "ncaab";
        pick.props.games.external_event_id = eventId;
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].game_status?.status).toBe("scheduled");
        expect(result.livePicks[0].sport).toBe("ncaab");
      });

      it("live with boxscore: halves period, correct value", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.sport = "ncaab";
        pick.props.games.external_event_id = eventId;
        pick.props.stat_category = "assists";
        pick.props.line = 5.5;
        const game = makeGame({
          game_id: eventId,
          status: "live",
          period: 2,
          clock: "12:00",
          home_team: "Duke Blue Devils",
          away_team: "UNC Tar Heels",
        });
        const player = makePlayer({ player_name: "LeBron James", assists: 10 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].game_status?.period).toBe(2);
        expect(result.livePicks[0].current_value).toBe(10);
        expect(result.livePicks[0].trending).toBe("hit");
      });

      it("final: correct value", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.sport = "ncaab";
        pick.props.games.external_event_id = eventId;
        pick.props.stat_category = "points";
        pick.props.line = 20.5;
        const game = makeGame({ game_id: eventId, status: "final", period: 2, clock: "0:00" });
        const player = makePlayer({ player_name: "LeBron James", points: 28 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].game_status?.status).toBe("final");
        expect(result.livePicks[0].current_value).toBe(28);
        expect(result.livePicks[0].trending).toBe("hit");
      });

      it("DB fallback when final: uses stored actual_value", () => {
        const pick = makePick({ actual_value: 22, result: "hit" });
        pick.props.games.sport = "ncaab";
        pick.props.games.external_event_id = eventId;
        pick.props.games.status = "final";
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].current_value).toBe(22);
        expect(result.livePicks[0].trending).toBe("hit");
      });
    });

    describe("EPL lifecycle", () => {
      const eventId = "epl-match-100";

      it("scheduled: no live data -> status=scheduled", () => {
        const pick = makePick();
        pick.props.games.sport = "epl";
        pick.props.games.external_event_id = eventId;
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].game_status?.status).toBe("scheduled");
        expect(result.livePicks[0].sport).toBe("epl");
      });

      it("live with boxscore: goals stat, correct value", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.sport = "epl";
        pick.props.games.external_event_id = eventId;
        pick.props.player_name = "Mohamed Salah";
        pick.props.stat_category = "goals";
        pick.props.line = 0.5;
        const game = makeGame({
          game_id: eventId,
          status: "live",
          period: 2,
          clock: "65:00",
          home_team: "Liverpool",
          away_team: "Arsenal",
        });
        const player = makePlayer({ player_name: "Mohamed Salah", goals: 2 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].current_value).toBe(2);
        expect(result.livePicks[0].trending).toBe("hit"); // 2 > 0.5
      });

      it("live with boxscore: shots_on_target stat", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.sport = "epl";
        pick.props.games.external_event_id = eventId;
        pick.props.player_name = "Mohamed Salah";
        pick.props.stat_category = "shots_on_target";
        pick.props.line = 1.5;
        const game = makeGame({ game_id: eventId, status: "live", period: 1, clock: "30:00" });
        const player = makePlayer({ player_name: "Mohamed Salah", shots_on_target: 3 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].current_value).toBe(3);
        expect(result.livePicks[0].trending).toBe("hit"); // 3 > 1.5
      });

      it("final: correct value", () => {
        const pick = makePick({ selection: "under" });
        pick.props.games.sport = "epl";
        pick.props.games.external_event_id = eventId;
        pick.props.player_name = "Mohamed Salah";
        pick.props.stat_category = "shots";
        pick.props.line = 4.5;
        const game = makeGame({ game_id: eventId, status: "final", period: 2, clock: "0:00" });
        const player = makePlayer({ player_name: "Mohamed Salah", shots: 4 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].current_value).toBe(4);
        expect(result.livePicks[0].trending).toBe("hit"); // 4 < 4.5 under
      });

      it("DB fallback when final: uses stored actual_value", () => {
        const pick = makePick({ actual_value: 1, result: "hit" });
        pick.props.games.sport = "epl";
        pick.props.games.external_event_id = eventId;
        pick.props.games.status = "final";
        pick.props.stat_category = "goals";
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].current_value).toBe(1);
        expect(result.livePicks[0].trending).toBe("hit");
      });
    });

    describe("La Liga lifecycle", () => {
      const eventId = "laliga-match-100";

      it("scheduled: no live data -> status=scheduled", () => {
        const pick = makePick();
        pick.props.games.sport = "la_liga";
        pick.props.games.external_event_id = eventId;
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].game_status?.status).toBe("scheduled");
        expect(result.livePicks[0].sport).toBe("la_liga");
      });

      it("live with boxscore: goals stat, correct value", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.sport = "la_liga";
        pick.props.games.external_event_id = eventId;
        pick.props.player_name = "Vinicius Jr";
        pick.props.stat_category = "goals";
        pick.props.line = 0.5;
        const game = makeGame({
          game_id: eventId,
          status: "live",
          period: 1,
          clock: "35:00",
          home_team: "Real Madrid",
          away_team: "Barcelona",
        });
        const player = makePlayer({ player_name: "Vinicius Jr", goals: 1 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].game_status?.sport).toBe("la_liga");
        expect(result.livePicks[0].current_value).toBe(1);
        expect(result.livePicks[0].trending).toBe("hit");
      });

      it("final: correct value", () => {
        const pick = makePick({ selection: "over" });
        pick.props.games.sport = "la_liga";
        pick.props.games.external_event_id = eventId;
        pick.props.player_name = "Vinicius Jr";
        pick.props.stat_category = "shots_on_target";
        pick.props.line = 1.5;
        const game = makeGame({ game_id: eventId, status: "final", period: 2, clock: "0:00" });
        const player = makePlayer({ player_name: "Vinicius Jr", shots_on_target: 2 });
        const result = buildLivePicksForCard(
          [pick],
          new Map([[eventId, game]]),
          new Map([[eventId, [player]]]),
        );
        expect(result.livePicks[0].game_status?.status).toBe("final");
        expect(result.livePicks[0].current_value).toBe(2);
        expect(result.livePicks[0].trending).toBe("hit");
      });

      it("DB fallback when final: uses stored actual_value", () => {
        const pick = makePick({ actual_value: 3, result: "miss" });
        pick.props.games.sport = "la_liga";
        pick.props.games.external_event_id = eventId;
        pick.props.games.status = "final";
        pick.props.stat_category = "shots";
        const result = buildLivePicksForCard(
          [pick],
          new Map<string, StatsGame>(),
          new Map<string, PlayerBoxScore[]>(),
        );
        expect(result.livePicks[0].current_value).toBe(3);
        expect(result.livePicks[0].trending).toBe("miss");
      });
    });
  });

  describe("combo stat categories", () => {
    const eventId = "401584900";

    function makeComboTest(
      category: string,
      line: number,
      selection: "over" | "under",
    ) {
      const pick = makePick({ selection });
      pick.props.games.external_event_id = eventId;
      pick.props.stat_category = category as any;
      pick.props.line = line;
      const game = makeGame({ game_id: eventId, status: "live", period: 3, clock: "5:00" });
      // points=28, rebounds=8, assists=10, blocks=1, steals=2
      const player = makePlayer({ player_name: "LeBron James" });
      return buildLivePicksForCard(
        [pick],
        new Map([[eventId, game]]),
        new Map([[eventId, [player]]]),
      );
    }

    it("pra: 28+8+10=46 > 40.5 -> hit", () => {
      const result = makeComboTest("pra", 40.5, "over");
      expect(result.livePicks[0].current_value).toBe(46);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("pts_reb: 28+8=36 > 35.5 -> hit", () => {
      const result = makeComboTest("pts_reb", 35.5, "over");
      expect(result.livePicks[0].current_value).toBe(36);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("pts_ast: 28+10=38 < 39.5 -> miss", () => {
      const result = makeComboTest("pts_ast", 39.5, "over");
      expect(result.livePicks[0].current_value).toBe(38);
      expect(result.livePicks[0].trending).toBe("miss");
    });

    it("reb_ast: 8+10=18 > 17.5 -> hit", () => {
      const result = makeComboTest("reb_ast", 17.5, "over");
      expect(result.livePicks[0].current_value).toBe(18);
      expect(result.livePicks[0].trending).toBe("hit");
    });

    it("blk_stl: 1+2=3 < 3.5 -> miss", () => {
      const result = makeComboTest("blk_stl", 3.5, "over");
      expect(result.livePicks[0].current_value).toBe(3);
      expect(result.livePicks[0].trending).toBe("miss");
    });
  });
});

/* ---------- toLivePickData ---------- */

describe("toLivePickData", () => {
  function makeResolvedPick(sport: string, result: "hit" | "miss" | "push" | "dnp" = "hit") {
    return {
      id: "pick-resolved",
      selection: "over",
      result,
      actual_value: 25,
      prop: {
        id: "prop-1",
        player_name: "Test Player",
        player_id: "123",
        player_team: "Team A",
        player_position: "G",
        stat_category: "points",
        line: 20.5,
        game_id: "game-1",
        games: { sport },
      },
    };
  }

  it("NCAAB resolved pick uses period=2 (halves, not quarters)", () => {
    const result = toLivePickData(makeResolvedPick("ncaab"));
    expect(result.game_status).not.toBeNull();
    expect(result.game_status!.period).toBe(2);
  });

  it("EPL resolved pick uses period=2 (halves)", () => {
    const result = toLivePickData(makeResolvedPick("epl"));
    expect(result.game_status!.period).toBe(2);
  });

  it("La Liga resolved pick uses period=2 (halves)", () => {
    const result = toLivePickData(makeResolvedPick("la_liga"));
    expect(result.game_status!.period).toBe(2);
  });

  it("NBA resolved pick uses period=4 (quarters)", () => {
    const result = toLivePickData(makeResolvedPick("nba"));
    expect(result.game_status!.period).toBe(4);
  });

  it("NHL resolved pick uses period=4 (quarters/periods)", () => {
    const result = toLivePickData(makeResolvedPick("nhl"));
    expect(result.game_status!.period).toBe(4);
  });

  it("unresolved pick has null game_status", () => {
    const pick = {
      id: "pick-pending",
      selection: "over",
      result: "pending",
      actual_value: null,
      prop: {
        id: "prop-1",
        player_name: "Test Player",
        player_id: null,
        stat_category: "points",
        line: 20.5,
        game_id: "game-1",
        games: { sport: "ncaab" },
      },
    };
    const result = toLivePickData(pick);
    expect(result.game_status).toBeNull();
  });
});
