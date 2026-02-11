import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENT_CHECKS,
  type AchievementContext,
} from "../definitions";

/** Helper to build a minimal AchievementContext with overrides */
function makeContext(
  overrides: Partial<AchievementContext> = {}
): AchievementContext {
  return {
    leaderboardStats: {
      total_cards: 0,
      current_streak: 0,
      best_streak: 0,
      win_rate: 0,
      h2h_wins: 0,
      h2h_losses: 0,
    },
    ...overrides,
  };
}

// ============================================================
// Definition check tests
// ============================================================

describe("Achievement definition checks", () => {
  // ---- first_blood ----
  describe("first_blood", () => {
    const check = ACHIEVEMENT_CHECKS.first_blood;

    it("returns false when total_cards is 0", () => {
      expect(check(makeContext())).toBe(false);
    });

    it("returns true when total_cards >= 1", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 1,
              current_streak: 0,
              best_streak: 0,
              win_rate: 0,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- perfect_six ----
  describe("perfect_six", () => {
    const check = ACHIEVEMENT_CHECKS.perfect_six;

    it("returns false when no card resolved", () => {
      expect(check(makeContext())).toBe(false);
    });

    it("returns false when score < 6", () => {
      expect(
        check(makeContext({ cardResolved: { score: 5, total: 6 } }))
      ).toBe(false);
    });

    it("returns true when score is exactly 6", () => {
      expect(
        check(makeContext({ cardResolved: { score: 6, total: 6 } }))
      ).toBe(true);
    });
  });

  // ---- hot_streak_3 ----
  describe("hot_streak_3", () => {
    const check = ACHIEVEMENT_CHECKS.hot_streak_3;

    it("returns false when current_streak < 3", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 5,
              current_streak: 2,
              best_streak: 2,
              win_rate: 50,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(false);
    });

    it("returns true when current_streak >= 3", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 5,
              current_streak: 3,
              best_streak: 3,
              win_rate: 60,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- hot_streak_5 ----
  describe("hot_streak_5", () => {
    const check = ACHIEVEMENT_CHECKS.hot_streak_5;

    it("returns false when current_streak < 5", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 10,
              current_streak: 4,
              best_streak: 4,
              win_rate: 60,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(false);
    });

    it("returns true when current_streak >= 5", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 10,
              current_streak: 5,
              best_streak: 5,
              win_rate: 70,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- hot_streak_10 ----
  describe("hot_streak_10", () => {
    const check = ACHIEVEMENT_CHECKS.hot_streak_10;

    it("returns true when current_streak >= 10", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 20,
              current_streak: 10,
              best_streak: 10,
              win_rate: 80,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- century ----
  describe("century", () => {
    const check = ACHIEVEMENT_CHECKS.century;

    it("returns false when total_cards < 100", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 99,
              current_streak: 0,
              best_streak: 0,
              win_rate: 50,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(false);
    });

    it("returns true when total_cards >= 100", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 100,
              current_streak: 0,
              best_streak: 0,
              win_rate: 50,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- sharpshooter ----
  describe("sharpshooter", () => {
    const check = ACHIEVEMENT_CHECKS.sharpshooter;

    it("returns false when win_rate >= 70 but total_cards < 20", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 19,
              current_streak: 0,
              best_streak: 0,
              win_rate: 75,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(false);
    });

    it("returns false when total_cards >= 20 but win_rate < 70", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 25,
              current_streak: 0,
              best_streak: 0,
              win_rate: 69,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(false);
    });

    it("returns true when both conditions met", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 20,
              current_streak: 0,
              best_streak: 0,
              win_rate: 70,
              h2h_wins: 0,
              h2h_losses: 0,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- rivalry ----
  describe("rivalry", () => {
    const check = ACHIEVEMENT_CHECKS.rivalry;

    it("returns false when h2h total < 10", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 10,
              current_streak: 0,
              best_streak: 0,
              win_rate: 50,
              h2h_wins: 4,
              h2h_losses: 5,
            },
          })
        )
      ).toBe(false);
    });

    it("returns true when h2h total >= 10", () => {
      expect(
        check(
          makeContext({
            leaderboardStats: {
              total_cards: 10,
              current_streak: 0,
              best_streak: 0,
              win_rate: 50,
              h2h_wins: 6,
              h2h_losses: 4,
            },
          })
        )
      ).toBe(true);
    });
  });

  // ---- social_butterfly ----
  describe("social_butterfly", () => {
    const check = ACHIEVEMENT_CHECKS.social_butterfly;

    it("returns false when friendCount < 5", () => {
      expect(check(makeContext({ friendCount: 4 }))).toBe(false);
    });

    it("returns false when friendCount is undefined", () => {
      expect(check(makeContext())).toBe(false);
    });

    it("returns true when friendCount >= 5", () => {
      expect(check(makeContext({ friendCount: 5 }))).toBe(true);
    });
  });

  // ---- night_owl ----
  describe("night_owl", () => {
    const check = ACHIEVEMENT_CHECKS.night_owl;

    it("returns false when cardLockedHour is undefined", () => {
      expect(check(makeContext())).toBe(false);
    });

    it("returns false when cardLockedHour < 22", () => {
      expect(check(makeContext({ cardLockedHour: 21 }))).toBe(false);
    });

    it("returns true when cardLockedHour >= 22", () => {
      expect(check(makeContext({ cardLockedHour: 22 }))).toBe(true);
    });

    it("returns true when cardLockedHour is 23", () => {
      expect(check(makeContext({ cardLockedHour: 23 }))).toBe(true);
    });
  });

  // ---- prophet ----
  describe("prophet", () => {
    const check = ACHIEVEMENT_CHECKS.prophet;

    it("returns false when no card resolved", () => {
      expect(check(makeContext())).toBe(false);
    });

    it("returns false when score < 5", () => {
      expect(
        check(makeContext({ cardResolved: { score: 4, total: 6 } }))
      ).toBe(false);
    });

    it("returns true when score is 5", () => {
      expect(
        check(makeContext({ cardResolved: { score: 5, total: 6 } }))
      ).toBe(true);
    });

    it("returns true when score is 6 (also triggers perfect_six)", () => {
      expect(
        check(makeContext({ cardResolved: { score: 6, total: 6 } }))
      ).toBe(true);
    });
  });
});

// ============================================================
// Verify the exported keys match the expected set (excluding underdog)
// ============================================================

describe("ACHIEVEMENT_CHECKS completeness", () => {
  const expectedKeys = [
    "first_blood",
    "perfect_six",
    "hot_streak_3",
    "hot_streak_5",
    "hot_streak_10",
    "century",
    "sharpshooter",
    "rivalry",
    "social_butterfly",
    "night_owl",
    "prophet",
  ];

  it("contains exactly 11 active badge checks (underdog excluded)", () => {
    expect(Object.keys(ACHIEVEMENT_CHECKS).sort()).toEqual(
      expectedKeys.sort()
    );
  });

  it("does NOT include underdog (deferred)", () => {
    expect(ACHIEVEMENT_CHECKS).not.toHaveProperty("underdog");
  });
});
