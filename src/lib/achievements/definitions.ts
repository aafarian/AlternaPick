import type { ChallengeResolutionResult } from "@/lib/challenges/resolution";

/**
 * Context object passed to each achievement check function.
 * Populated by the caller (resolution flow, friend action, etc.)
 * with whatever data is available at the time.
 */
export interface AchievementContext {
  /** Present when a card was just resolved */
  cardResolved?: {
    score: number;
    total: number;
  };
  /** Present when a challenge was just resolved */
  challengeResolved?: ChallengeResolutionResult;
  /** Present when a friend request was just accepted */
  friendAction?: "accepted";
  /** Leaderboard stats for the user (always present) */
  leaderboardStats: {
    total_cards: number;
    current_streak: number;
    best_streak: number;
    win_rate: number;
    h2h_wins: number;
    h2h_losses: number;
  };
  /** Number of accepted friends the user has */
  friendCount?: number;
  /** Hour (0-23) when the card was locked */
  cardLockedHour?: number;
}

/**
 * A check function returns true when the achievement should be unlocked.
 */
export type AchievementCheck = (ctx: AchievementContext) => boolean;

/**
 * Map of achievement key -> check function.
 * Keys must match the `key` column in the `achievements` table.
 * The `underdog` badge is intentionally omitted (deferred).
 */
export const ACHIEVEMENT_CHECKS: Record<string, AchievementCheck> = {
  /** Lock your first card */
  first_blood: (ctx) => ctx.leaderboardStats.total_cards >= 1,

  /** Score 6/6 on a card */
  perfect_six: (ctx) => ctx.cardResolved?.score === 6,

  /** 3 winning cards in a row */
  hot_streak_3: (ctx) => ctx.leaderboardStats.current_streak >= 3,

  /** 5 winning cards in a row */
  hot_streak_5: (ctx) => ctx.leaderboardStats.current_streak >= 5,

  /** 10 winning cards in a row */
  hot_streak_10: (ctx) => ctx.leaderboardStats.current_streak >= 10,

  /** Lock 100 cards */
  century: (ctx) => ctx.leaderboardStats.total_cards >= 100,

  /** 70%+ win rate over 20+ cards */
  sharpshooter: (ctx) =>
    ctx.leaderboardStats.win_rate >= 70 &&
    ctx.leaderboardStats.total_cards >= 20,

  /** Complete 10 H2H challenges (wins + losses) */
  rivalry: (ctx) =>
    ctx.leaderboardStats.h2h_wins + ctx.leaderboardStats.h2h_losses >= 10,

  /** Add 5 friends */
  social_butterfly: (ctx) => (ctx.friendCount ?? 0) >= 5,

  /** Lock a card after 10 PM local time */
  night_owl: (ctx) =>
    ctx.cardLockedHour !== undefined && ctx.cardLockedHour >= 22,

  /** Score 5+ out of 6 on a card */
  prophet: (ctx) =>
    ctx.cardResolved !== undefined && ctx.cardResolved.score >= 5,
};
