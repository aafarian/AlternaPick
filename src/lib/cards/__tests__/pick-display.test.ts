import { describe, it, expect } from "vitest";
import { computePickDisplay } from "../pick-display";
import type { LivePickData } from "../live-types";
import type { LiveGameStatus } from "../live-types";

/* ---------- helpers ---------- */

function makeGameStatus(
  overrides: Partial<LiveGameStatus> = {},
): LiveGameStatus {
  return {
    game_id: "game-1",
    external_event_id: "ext-1",
    status: "live",
    period: 3,
    clock: "5:30",
    home_team: "Lakers",
    away_team: "Celtics",
    home_tricode: "LAL",
    away_tricode: "BOS",
    home_score: 85,
    away_score: 80,
    commence_time: null,
    ...overrides,
  };
}

function makePick(overrides: Partial<LivePickData> = {}): LivePickData {
  return {
    pick_id: "pick-1",
    player_name: "LeBron James",
    player_id: "2544",
    player_team: "LAL",
    player_position: "F",
    stat_category: "points",
    line: 25.5,
    selection: "over",
    current_value: null,
    trending: null,
    game_status: null,
    ...overrides,
  };
}

/* ---------- state flags ---------- */

describe("computePickDisplay", () => {
  describe("state flags", () => {
    it("pre-game: no game_status -> isPreGame=true", () => {
      const result = computePickDisplay(makePick({ game_status: null }));
      expect(result.isPreGame).toBe(true);
      expect(result.isLive).toBe(false);
      expect(result.isFinal).toBe(false);
    });

    it("pre-game: status=scheduled -> isPreGame=true", () => {
      const result = computePickDisplay(
        makePick({ game_status: makeGameStatus({ status: "scheduled" }) }),
      );
      expect(result.isPreGame).toBe(true);
      expect(result.isLive).toBe(false);
      expect(result.isFinal).toBe(false);
    });

    it("pre-game: status=scheduled with future commence_time -> isPreGame=true", () => {
      const future = new Date(Date.now() + 3600_000).toISOString();
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({
            status: "scheduled",
            commence_time: future,
          }),
        }),
      );
      expect(result.isPreGame).toBe(true);
      expect(result.isAwaitingLive).toBe(false);
    });

    it("scheduled but started: commence_time in the past -> isPreGame=false, isAwaitingLive=true", () => {
      const past = new Date(Date.now() - 600_000).toISOString(); // 10 min ago
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({
            status: "scheduled",
            commence_time: past,
          }),
        }),
      );
      expect(result.isPreGame).toBe(false);
      expect(result.isAwaitingLive).toBe(true);
      expect(result.isLive).toBe(false);
    });

    it("live game -> isLive=true, isPreGame=false", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "live" }),
          current_value: 10,
        }),
      );
      expect(result.isLive).toBe(true);
      expect(result.isPreGame).toBe(false);
      expect(result.isFinal).toBe(false);
    });

    it("final game -> isFinal=true, isPreGame=false", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "final" }),
          current_value: 30,
          trending: "hit",
        }),
      );
      expect(result.isFinal).toBe(true);
      expect(result.isPreGame).toBe(false);
      expect(result.isLive).toBe(false);
    });

    it("awaiting live: no game_status, no value -> isAwaitingLive=true", () => {
      const result = computePickDisplay(
        makePick({ game_status: null, current_value: null }),
      );
      expect(result.isAwaitingLive).toBe(true);
    });

    it("has game_status but no value -> isAwaitingLive=false", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "live" }),
          current_value: null,
        }),
      );
      expect(result.isAwaitingLive).toBe(false);
    });
  });

  /* ---------- over/under winning logic ---------- */

  describe("winning/losing for over picks", () => {
    it("over pick, value > line -> isWinning=true", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          line: 25.5,
          current_value: 28,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.isOver).toBe(true);
      expect(result.isWinning).toBe(true);
    });

    it("over pick, value < line -> isWinning=false", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          line: 25.5,
          current_value: 20,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.isOver).toBe(true);
      expect(result.isWinning).toBe(false);
    });

    it("over pick, value exactly at line -> isWinning=false (rawPct=100, not > 100)", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          line: 25,
          current_value: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.isWinning).toBe(false);
    });
  });

  describe("winning/losing for under picks", () => {
    it("under pick, value < line -> isWinning=true", () => {
      const result = computePickDisplay(
        makePick({
          selection: "under",
          line: 25.5,
          current_value: 20,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.isOver).toBe(false);
      expect(result.isWinning).toBe(true);
    });

    it("under pick, value > line -> isWinning=false", () => {
      const result = computePickDisplay(
        makePick({
          selection: "under",
          line: 25.5,
          current_value: 28,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.isOver).toBe(false);
      expect(result.isWinning).toBe(false);
    });

    it("under pick, value exactly at line -> isWinning=true (rawPct=100, not < 100 -> false)", () => {
      // rawPct = (25/25)*100 = 100; for under, isWinning = rawPct < 100 => false
      const result = computePickDisplay(
        makePick({
          selection: "under",
          line: 25,
          current_value: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.isWinning).toBe(false);
    });
  });

  /* ---------- settled states ---------- */

  describe("settled picks", () => {
    it("final hit -> settledWon=true, isSettled=true", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "final" }),
          current_value: 30,
          trending: "hit",
          selection: "over",
          line: 25.5,
        }),
      );
      expect(result.isFinal).toBe(true);
      expect(result.isSettled).toBe(true);
      expect(result.settledWon).toBe(true);
    });

    it("final miss -> settledWon=false, isSettled=true", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "final" }),
          current_value: 20,
          trending: "miss",
          selection: "over",
          line: 25.5,
        }),
      );
      expect(result.isFinal).toBe(true);
      expect(result.isSettled).toBe(true);
      expect(result.settledWon).toBe(false);
    });

    it("final with no value but trending=hit -> settledWon=true", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "final" }),
          current_value: null,
          trending: "hit",
          selection: "over",
          line: 25.5,
        }),
      );
      expect(result.isSettled).toBe(true);
      expect(result.settledWon).toBe(true);
    });

    it("final with no value but trending=miss -> settledWon=false", () => {
      const result = computePickDisplay(
        makePick({
          game_status: makeGameStatus({ status: "final" }),
          current_value: null,
          trending: "miss",
          selection: "over",
          line: 25.5,
        }),
      );
      expect(result.isSettled).toBe(true);
      expect(result.settledWon).toBe(false);
    });
  });

  /* ---------- DNP ---------- */

  describe("DNP pick", () => {
    it("trending=dnp -> isDnp=true, settledWon=null", () => {
      const result = computePickDisplay(
        makePick({
          trending: "dnp",
          game_status: makeGameStatus({ status: "final" }),
          current_value: null,
        }),
      );
      expect(result.isDnp).toBe(true);
      expect(result.isSettled).toBe(true);
      expect(result.settledWon).toBe(null);
    });

    it("DNP accent -> muted foreground", () => {
      const result = computePickDisplay(
        makePick({
          trending: "dnp",
          game_status: makeGameStatus({ status: "final" }),
          current_value: null,
        }),
      );
      expect(result.accentClass).toBe("border-l-muted-foreground/40");
    });
  });

  /* ---------- void / push ---------- */

  describe("void/push pick", () => {
    it("trending=push, final -> isVoid=true, settledWon=null", () => {
      const result = computePickDisplay(
        makePick({
          trending: "push",
          game_status: makeGameStatus({ status: "final" }),
          current_value: 25,
          line: 25,
        }),
      );
      expect(result.isVoid).toBe(true);
      expect(result.isSettled).toBe(true);
      expect(result.settledWon).toBe(null);
    });

    it("trending=push, no game_status -> isVoid=true (pre-resolved)", () => {
      const result = computePickDisplay(
        makePick({
          trending: "push",
          game_status: null,
          current_value: 25,
          line: 25,
        }),
      );
      expect(result.isVoid).toBe(true);
    });

    it("trending=push, live game -> isVoid=false (live tie, not voided)", () => {
      const result = computePickDisplay(
        makePick({
          trending: "push",
          game_status: makeGameStatus({ status: "live" }),
          current_value: 25,
          line: 25,
        }),
      );
      expect(result.isVoid).toBe(false);
    });

    it("void accent -> muted foreground", () => {
      const result = computePickDisplay(
        makePick({
          trending: "push",
          game_status: makeGameStatus({ status: "final" }),
          current_value: 25,
          line: 25,
        }),
      );
      expect(result.accentClass).toBe("border-l-muted-foreground/40");
    });
  });

  /* ---------- bar calculations ---------- */

  describe("bar width and line position", () => {
    it("linePosition is always 90", () => {
      const result = computePickDisplay(makePick());
      expect(result.linePosition).toBe(90);
    });

    it("value at 50% of line -> barWidth = 45 (50% of 90)", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 12.5,
          line: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barWidth).toBe(45);
    });

    it("value at line (100%) -> barWidth = 90 (100% of 90)", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 25,
          line: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barWidth).toBe(90);
    });

    it("value exceeds line -> barWidth = 100 (capped)", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 30,
          line: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barWidth).toBe(100);
    });

    it("no value -> barWidth = 0", () => {
      const result = computePickDisplay(
        makePick({ current_value: null, line: 25 }),
      );
      expect(result.barWidth).toBe(0);
    });

    it("line = 0 -> barWidth = 0 (avoid division by zero)", () => {
      const result = computePickDisplay(
        makePick({ current_value: 5, line: 0 }),
      );
      expect(result.barWidth).toBe(0);
    });

    it("barWidth never exceeds 100", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 1000,
          line: 10,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barWidth).toBeLessThanOrEqual(100);
    });

    it("barWidth never goes below 0", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 0,
          line: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barWidth).toBeGreaterThanOrEqual(0);
    });
  });

  /* ---------- no value ---------- */

  describe("no value pick", () => {
    it("current_value=null -> hasValue=false", () => {
      const result = computePickDisplay(
        makePick({ current_value: null }),
      );
      expect(result.hasValue).toBe(false);
    });

    it("current_value=0 -> hasValue=true (0 is a valid stat value)", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 0,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.hasValue).toBe(true);
    });
  });

  /* ---------- bar colors ---------- */

  describe("bar colors", () => {
    it("no value -> bg-foreground/12", () => {
      const result = computePickDisplay(
        makePick({ current_value: null }),
      );
      expect(result.barColor).toBe("bg-foreground/12");
    });

    it("winning -> bg-neon-green/30", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          current_value: 30,
          line: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barColor).toBe("bg-neon-green/30");
    });

    it("losing -> bg-bold-red/25", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          current_value: 20,
          line: 25,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.barColor).toBe("bg-bold-red/25");
    });
  });

  /* ---------- accent classes ---------- */

  describe("accent classes", () => {
    it("settled won -> border-l-neon-green/60", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          current_value: 30,
          line: 25,
          trending: "hit",
          game_status: makeGameStatus({ status: "final" }),
        }),
      );
      expect(result.accentClass).toBe("border-l-neon-green/60");
    });

    it("settled lost -> border-l-bold-red/60", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          current_value: 20,
          line: 25,
          trending: "miss",
          game_status: makeGameStatus({ status: "final" }),
        }),
      );
      expect(result.accentClass).toBe("border-l-bold-red/60");
    });

    it("not settled -> border-l-transparent", () => {
      const result = computePickDisplay(
        makePick({
          selection: "over",
          current_value: 20,
          line: 25,
          trending: null,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.accentClass).toBe("border-l-transparent");
    });

    it("DNP -> border-l-muted-foreground/40", () => {
      const result = computePickDisplay(
        makePick({ trending: "dnp" }),
      );
      expect(result.accentClass).toBe("border-l-muted-foreground/40");
    });

    it("void -> border-l-muted-foreground/40", () => {
      const result = computePickDisplay(
        makePick({
          trending: "push",
          game_status: makeGameStatus({ status: "final" }),
        }),
      );
      expect(result.accentClass).toBe("border-l-muted-foreground/40");
    });
  });

  /* ---------- inPlay ---------- */

  describe("inPlay", () => {
    it("live + not settled -> inPlay=true", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 15,
          line: 25,
          trending: null,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.inPlay).toBe(true);
    });

    it("live + settled (crossed line) -> inPlay=false", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 30,
          line: 25,
          trending: null,
          game_status: makeGameStatus({ status: "live" }),
        }),
      );
      expect(result.inPlay).toBe(false);
    });

    it("final -> inPlay=false", () => {
      const result = computePickDisplay(
        makePick({
          current_value: 30,
          line: 25,
          trending: "hit",
          game_status: makeGameStatus({ status: "final" }),
        }),
      );
      expect(result.inPlay).toBe(false);
    });

    it("pre-game -> inPlay=false", () => {
      const result = computePickDisplay(makePick({ game_status: null }));
      expect(result.inPlay).toBe(false);
    });
  });
});
