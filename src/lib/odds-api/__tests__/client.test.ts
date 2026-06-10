import { describe, it, expect } from "vitest";
import { parseOddsResponse, selectMainLine } from "../client";
import type {
  OddsApiBookmaker,
  OddsApiOddsResponse,
  OddsApiOutcome,
} from "../types";
import type { StatCategory } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Helpers to build Odds API response fixtures
// ---------------------------------------------------------------------------

function outcome(
  name: "Over" | "Under" | "Yes" | "No",
  player: string,
  price: number,
  point: number
): OddsApiOutcome {
  return { name, description: player, price, point };
}

function book(
  key: string,
  marketKey: string,
  outcomes: OddsApiOutcome[]
): OddsApiBookmaker {
  return {
    key,
    title: key,
    last_update: "2026-06-10T00:00:00Z",
    markets: [{ key: marketKey, last_update: "2026-06-10T00:00:00Z", outcomes }],
  };
}

function response(bookmakers: OddsApiBookmaker[]): OddsApiOddsResponse {
  return {
    id: "evt1",
    sport_key: "baseball_mlb",
    sport_title: "MLB",
    commence_time: "2026-06-10T18:00:00Z",
    home_team: "Home",
    away_team: "Away",
    bookmakers,
  };
}

const HR_MAP: Record<string, StatCategory> = { batter_home_runs: "home_runs" };
const PTS_MAP: Record<string, StatCategory> = { player_points: "points" };

// ---------------------------------------------------------------------------
// selectMainLine
// ---------------------------------------------------------------------------

describe("selectMainLine", () => {
  it("returns null for no lines", () => {
    expect(selectMainLine([])).toBeNull();
  });

  it("picks the lowest line when all lines are one-sided (home runs)", () => {
    // HR is quoted Over-only at 0.5 / 1.5 / 2.5 — the base milestone is 0.5
    const main = selectMainLine([
      { line: 0.5, over: 450, under: null },
      { line: 1.5, over: 5000, under: null },
      { line: 2.5, over: 11000, under: null },
    ]);
    expect(main?.line).toBe(0.5);
  });

  it("picks the most balanced two-sided line over an alternate ladder", () => {
    // Bovada-style points ladder; 13.5 is the balanced (true) line
    const main = selectMainLine([
      { line: 10.5, over: -280, under: 205 },
      { line: 11.5, over: -200, under: 150 },
      { line: 13.5, over: -115, under: -115 },
      { line: 15.5, over: 145, under: -190 },
    ]);
    expect(main?.line).toBe(13.5);
  });

  it("prefers a two-sided line even when a lower one-sided line exists", () => {
    const main = selectMainLine([
      { line: 0.5, over: -155, under: null },
      { line: 1.5, over: -110, under: -110 },
    ]);
    expect(main?.line).toBe(1.5);
  });

  it("breaks ties toward the lower line", () => {
    const main = selectMainLine([
      { line: 2.5, over: -110, under: -110 },
      { line: 3.5, over: -110, under: -110 },
    ]);
    expect(main?.line).toBe(2.5);
  });
});

// ---------------------------------------------------------------------------
// parseOddsResponse — home runs (the exploit)
// ---------------------------------------------------------------------------

describe("parseOddsResponse — home runs", () => {
  it("produces a 0.5 consensus line from one-sided milestone ladders", () => {
    // Two books each quoting HR as Over-only at 0.5/1.5/2.5.
    // Old median-of-all-lines logic produced 1.5 (the exploit); the fix
    // must produce 0.5.
    const data = response([
      book("williamhill_us", "batter_home_runs", [
        outcome("Over", "Junior Caminero", 500, 0.5),
        outcome("Over", "Junior Caminero", 6000, 1.5),
      ]),
      book("betrivers", "batter_home_runs", [
        outcome("Over", "Junior Caminero", 460, 0.5),
        outcome("Over", "Junior Caminero", 6600, 1.5),
        outcome("Over", "Junior Caminero", 11000, 2.5),
      ]),
    ]);

    const props = parseOddsResponse(data, HR_MAP);
    expect(props).toHaveLength(1);
    expect(props[0].player_name).toBe("Junior Caminero");
    expect(props[0].stat_category).toBe("home_runs");
    expect(props[0].line).toBe(0.5);
    expect(props[0].bookmaker).toBe("consensus");
  });

  it("uses the 0.5 line when a book quotes HR two-sided at 0.5", () => {
    const data = response([
      book("fanduel", "batter_home_runs", [
        outcome("Over", "Aaron Judge", -110, 0.5),
        outcome("Under", "Aaron Judge", -110, 0.5),
        outcome("Over", "Aaron Judge", 600, 1.5),
      ]),
    ]);
    const props = parseOddsResponse(data, HR_MAP);
    expect(props[0].line).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// parseOddsResponse — points (must not regress)
// ---------------------------------------------------------------------------

describe("parseOddsResponse — points", () => {
  it("selects the balanced main line and ignores alternate ladders", () => {
    const data = response([
      book("fanduel", "player_points", [
        outcome("Over", "Dylan Harper", -118, 13.5),
        outcome("Under", "Dylan Harper", -112, 13.5),
      ]),
      book("draftkings", "player_points", [
        outcome("Over", "Dylan Harper", -121, 13.5),
        outcome("Under", "Dylan Harper", -106, 13.5),
      ]),
      // Bovada alternate ladder around the same line
      book("bovada", "player_points", [
        outcome("Over", "Dylan Harper", -280, 10.5),
        outcome("Under", "Dylan Harper", 205, 10.5),
        outcome("Over", "Dylan Harper", -115, 13.5),
        outcome("Under", "Dylan Harper", -115, 13.5),
        outcome("Over", "Dylan Harper", 185, 16.5),
        outcome("Under", "Dylan Harper", -250, 16.5),
      ]),
    ]);

    const props = parseOddsResponse(data, PTS_MAP);
    expect(props).toHaveLength(1);
    expect(props[0].line).toBe(13.5);
  });

  it("takes the median when bookmakers disagree on the main line", () => {
    const data = response([
      book("a", "player_points", [
        outcome("Over", "Star Player", -110, 24.5),
        outcome("Under", "Star Player", -110, 24.5),
      ]),
      book("b", "player_points", [
        outcome("Over", "Star Player", -110, 25.5),
        outcome("Under", "Star Player", -110, 25.5),
      ]),
      book("c", "player_points", [
        outcome("Over", "Star Player", -110, 25.5),
        outcome("Under", "Star Player", -110, 25.5),
      ]),
    ]);
    const props = parseOddsResponse(data, PTS_MAP);
    expect(props[0].line).toBe(25.5);
  });

  it("carries odds from the book whose main line matches the consensus", () => {
    const data = response([
      book("a", "player_points", [
        outcome("Over", "P", -200, 20.5),
        outcome("Under", "P", 160, 20.5),
      ]),
      book("b", "player_points", [
        outcome("Over", "P", -105, 22.5),
        outcome("Under", "P", -115, 22.5),
      ]),
      book("c", "player_points", [
        outcome("Over", "P", -110, 22.5),
        outcome("Under", "P", -110, 22.5),
      ]),
    ]);
    const props = parseOddsResponse(data, PTS_MAP);
    // median of [20.5, 22.5, 22.5] = 22.5; odds should come from a 22.5 book
    expect(props[0].line).toBe(22.5);
    expect(props[0].over_odds).not.toBe(-200);
  });
});

// ---------------------------------------------------------------------------
// parseOddsResponse — misc
// ---------------------------------------------------------------------------

describe("parseOddsResponse — misc", () => {
  it("ignores markets not present in the category map", () => {
    const data = response([
      book("a", "unknown_market", [outcome("Over", "X", -110, 1.5)]),
    ]);
    expect(parseOddsResponse(data, PTS_MAP)).toHaveLength(0);
  });

  it("handles anytime Yes/No markets (default 0.5 line)", () => {
    const data = response([
      book("a", "player_goal_scorer_anytime", [
        outcome("Yes", "Striker", 150, 0.5),
        outcome("No", "Striker", -180, 0.5),
      ]),
    ]);
    const props = parseOddsResponse(data, {
      player_goal_scorer_anytime: "goals",
    });
    expect(props[0].line).toBe(0.5);
    expect(props[0].over_odds).toBe(150);
    expect(props[0].under_odds).toBe(-180);
  });
});
