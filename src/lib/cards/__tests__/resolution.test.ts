import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractStatValue, fuzzyMatchPlayer } from "../resolution-utils";
import { resolveCard } from "../resolution";
import type { PlayerBoxScore } from "@/lib/stats-service/client";
import { makePlayer } from "./factories";

// Mock getBoxscoreFetcher so resolveCard never makes real API calls
vi.mock("@/lib/sports/fetchers", () => ({
  getBoxscoreFetcher: vi.fn(() => vi.fn(async () => [])),
}));

// Mock logger to suppress output during tests
vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

/* ---------- extractStatValue ---------- */

describe("extractStatValue", () => {
  const stats = makePlayer();

  it("returns points", () => {
    expect(extractStatValue(stats, "points")).toBe(28);
  });

  it("returns rebounds", () => {
    expect(extractStatValue(stats, "rebounds")).toBe(8);
  });

  it("returns assists", () => {
    expect(extractStatValue(stats, "assists")).toBe(10);
  });

  it("returns threes (threes_made)", () => {
    expect(extractStatValue(stats, "threes")).toBe(4);
  });

  it("returns blocks", () => {
    expect(extractStatValue(stats, "blocks")).toBe(1);
  });

  it("returns steals", () => {
    expect(extractStatValue(stats, "steals")).toBe(2);
  });

  it("returns turnovers", () => {
    expect(extractStatValue(stats, "turnovers")).toBe(3);
  });

  it("returns PRA (points + rebounds + assists)", () => {
    expect(extractStatValue(stats, "pra")).toBe(28 + 8 + 10);
  });

  it("returns pts_reb (points + rebounds)", () => {
    expect(extractStatValue(stats, "pts_reb")).toBe(28 + 8);
  });

  it("returns pts_ast (points + assists)", () => {
    expect(extractStatValue(stats, "pts_ast")).toBe(28 + 10);
  });

  it("returns reb_ast (rebounds + assists)", () => {
    expect(extractStatValue(stats, "reb_ast")).toBe(8 + 10);
  });

  it("returns blk_stl (blocks + steals)", () => {
    expect(extractStatValue(stats, "blk_stl")).toBe(1 + 2);
  });

  it("returns 0 for unknown category", () => {
    // Cast to force an unhandled category
    expect(extractStatValue(stats, "unknown" as any)).toBe(0);
  });

  /* ===== Soccer stat categories ===== */

  describe("soccer stats", () => {
    it("returns goals when present", () => {
      const player = makePlayer({ goals: 2 });
      expect(extractStatValue(player, "goals")).toBe(2);
    });

    it("returns 0 for goals when undefined", () => {
      const player = makePlayer();
      expect(extractStatValue(player, "goals")).toBe(0);
    });

    it("returns shots_on_target when present", () => {
      const player = makePlayer({ shots_on_target: 3 });
      expect(extractStatValue(player, "shots_on_target")).toBe(3);
    });

    it("returns 0 for shots_on_target when undefined", () => {
      const player = makePlayer();
      expect(extractStatValue(player, "shots_on_target")).toBe(0);
    });

    it("returns tackles when present", () => {
      const player = makePlayer({ tackles: 5 });
      expect(extractStatValue(player, "tackles")).toBe(5);
    });

    it("returns 0 for tackles when undefined", () => {
      const player = makePlayer();
      expect(extractStatValue(player, "tackles")).toBe(0);
    });

    it("returns passes when present", () => {
      const player = makePlayer({ passes: 48 });
      expect(extractStatValue(player, "passes")).toBe(48);
    });

    it("returns 0 for passes when undefined", () => {
      const player = makePlayer();
      expect(extractStatValue(player, "passes")).toBe(0);
    });

    it("returns fouls_committed when present", () => {
      const player = makePlayer({ fouls_committed: 3 });
      expect(extractStatValue(player, "fouls_committed")).toBe(3);
    });

    it("returns 0 for fouls_committed when undefined", () => {
      const player = makePlayer();
      expect(extractStatValue(player, "fouls_committed")).toBe(0);
    });

    it("returns saves when present", () => {
      const player = makePlayer({ saves: 6 });
      expect(extractStatValue(player, "saves")).toBe(6);
    });

    it("returns 0 for saves when undefined", () => {
      const player = makePlayer();
      expect(extractStatValue(player, "saves")).toBe(0);
    });
  });
});

/* ---------- fuzzyMatchPlayer ---------- */

describe("fuzzyMatchPlayer", () => {
  const boxscore: PlayerBoxScore[] = [
    makePlayer({ player_name: "LeBron James" }),
    makePlayer({ player_name: "Anthony Davis", player_id: "203076" }),
    makePlayer({ player_name: "Nikola Jokic", player_id: "203999" }),
    makePlayer({ player_name: "Luka Doncic", player_id: "1629029" }),
  ];

  it("finds exact match", () => {
    const result = fuzzyMatchPlayer(boxscore, "LeBron James");
    expect(result?.player_name).toBe("LeBron James");
  });

  it("finds case-insensitive match", () => {
    const result = fuzzyMatchPlayer(boxscore, "lebron james");
    expect(result?.player_name).toBe("LeBron James");
  });

  it("finds match with diacritics stripped (e.g. Jokić -> Jokic)", () => {
    const result = fuzzyMatchPlayer(boxscore, "Nikola Joki\u0107");
    expect(result?.player_name).toBe("Nikola Jokic");
  });

  it("finds match by diacritics in boxscore name", () => {
    const accented = [
      ...boxscore.slice(0, 3),
      makePlayer({ player_name: "Luka Don\u010di\u0107", player_id: "1629029" }),
    ];
    const result = fuzzyMatchPlayer(accented, "Luka Doncic");
    expect(result?.player_name).toBe("Luka Don\u010di\u0107");
  });

  it("finds unique last-name match", () => {
    const result = fuzzyMatchPlayer(boxscore, "Davis");
    expect(result?.player_name).toBe("Anthony Davis");
  });

  it("falls back to partial match when last name is ambiguous", () => {
    // Add a second "Davis" to make last-name match ambiguous
    const ambiguous = [
      ...boxscore,
      makePlayer({ player_name: "Ed Davis", player_id: "203076b" }),
    ];
    // "Anthony Davis" should still be found via partial-contains
    const result = fuzzyMatchPlayer(ambiguous, "Anthony Davis");
    expect(result?.player_name).toBe("Anthony Davis");
  });

  it("returns undefined when no match found", () => {
    const result = fuzzyMatchPlayer(boxscore, "Michael Jordan");
    expect(result).toBeUndefined();
  });
});

/* ---------- resolveCard — empty boxscore handling ---------- */

import { getBoxscoreFetcher } from "@/lib/sports/fetchers";

function makeCardWithPick(overrides: {
  sport?: string;
  commenceTime?: string;
  eventId?: string;
  playerName?: string;
  line?: number;
  selection?: "over" | "under";
}) {
  const {
    sport = "nba",
    commenceTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    eventId = "evt-1",
    playerName = "LeBron James",
    line = 25.5,
    selection = "under",
  } = overrides;

  const card = {
    id: "card-1",
    user_id: "user-1",
    anon_id: null,
    challenge_id: null,
    status: "locked" as const,
    score: 0,
    total_picks: 0,
    card_size: 1,
    game_mode: "classic" as const,
    locked_at: new Date().toISOString(),
    resolved_at: null,
    share_token: null,
    created_at: new Date().toISOString(),
    picks: [
      {
        id: "pick-1",
        card_id: "card-1",
        prop_id: "prop-1",
        selection,
        result: "pending" as const,
        actual_value: null,
        created_at: new Date().toISOString(),
        props: {
          id: "prop-1",
          game_id: "game-1",
          player_name: playerName,
          player_id: "2544",
          player_team: "LAL",
          player_position: "SF",
          stat_category: "points" as const,
          line,
          over_odds: null,
          under_odds: null,
          bookmaker: null,
          fetched_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          line_history: null,
          games: {
            id: "game-1",
            odds_api_event_id: "odds-1",
            home_team: "LAL",
            away_team: "BOS",
            commence_time: commenceTime,
            status: "final" as const,
            home_score: 0,
            away_score: 0,
            external_event_id: eventId,
            sport,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        },
      },
    ],
  };
  return card;
}

describe("resolveCard — empty boxscore", () => {
  beforeEach(() => {
    vi.mocked(getBoxscoreFetcher).mockReturnValue(vi.fn(async () => []));
  });

  it("retries for soccer game < 6h old", async () => {
    const card = makeCardWithPick({
      sport: "epl",
      commenceTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
    });

    const result = await resolveCard(card, new Map());
    expect(result).toBeNull();
  });

  it("voids as push for soccer game > 6h old", async () => {
    const card = makeCardWithPick({
      sport: "epl",
      commenceTime: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8h ago
    });

    const result = await resolveCard(card, new Map());
    expect(result).not.toBeNull();
    expect(result!.picks[0].result).toBe("push");
    expect(result!.picks[0].actual_value).toBeNull();
  });

  it("retries for NBA game < 48h old", async () => {
    const card = makeCardWithPick({
      sport: "nba",
      commenceTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
    });

    const result = await resolveCard(card, new Map());
    expect(result).toBeNull();
  });

  it("voids as push for NBA game > 48h old", async () => {
    const card = makeCardWithPick({
      sport: "nba",
      commenceTime: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50h ago
    });

    const result = await resolveCard(card, new Map());
    expect(result).not.toBeNull();
    expect(result!.picks[0].result).toBe("push");
    expect(result!.picks[0].actual_value).toBeNull();
  });

  it("resolves normally when boxscore has player data", async () => {
    vi.mocked(getBoxscoreFetcher).mockReturnValue(
      vi.fn(async () => [makePlayer({ player_name: "LeBron James", points: 30 })]),
    );

    const card = makeCardWithPick({
      sport: "nba",
      playerName: "LeBron James",
      line: 25.5,
      selection: "over",
    });

    const result = await resolveCard(card, new Map());
    expect(result).not.toBeNull();
    expect(result!.picks[0].result).toBe("hit");
    expect(result!.picks[0].actual_value).toBe(30);
  });
});
