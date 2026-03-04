import { describe, it, expect } from "vitest";
import { extractStatValue, fuzzyMatchPlayer } from "../resolution";
import type { PlayerBoxScore } from "@/lib/stats-service/client";

/* ---------- helpers ---------- */

function makePlayer(overrides: Partial<PlayerBoxScore> = {}): PlayerBoxScore {
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
