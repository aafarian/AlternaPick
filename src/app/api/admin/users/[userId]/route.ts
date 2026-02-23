import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, handleApiError } from "@/lib/api/errors";
import type { AdminUserDetail } from "@/lib/admin/types";
import type {
  CardStatus,
  GameMode,
  AchievementTier,
  AchievementCategory,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Row types for query results
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_deactivated: boolean;
  created_at: string;
  updated_at: string;
};

type LeaderboardRow = {
  total_cards: number;
  total_correct_picks: number;
  total_attempted_picks: number;
  win_rate: number;
  current_streak: number;
  best_streak: number;
  daily_streak: number;
  best_daily_streak: number;
  h2h_wins: number;
  h2h_losses: number;
  h2h_win_pct: number;
};

type CardRow = {
  id: string;
  status: CardStatus;
  score: number;
  total_picks: number;
  card_size: number;
  game_mode: GameMode;
  locked_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

type ChallengeRow = {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  game_mode: GameMode;
  winner_id: string | null;
  resolved_at: string | null;
  created_at: string;
  challenger: { id: string; username: string; display_name: string | null };
  opponent: { id: string; username: string; display_name: string | null };
};

type AchievementRow = {
  id: string;
  unlocked_at: string;
  achievement: {
    id: string;
    name: string;
    description: string;
    icon: string;
    tier: AchievementTier;
    category: AchievementCategory | null;
  };
};

/**
 * GET /api/admin/users/:userId
 * Returns comprehensive user detail for the admin dashboard.
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { userId } = await params;
    const supabase = createAdminClient();

    // Fetch profile first — return 404 if not found
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profileData, error: profileError } = await (
      supabase.from("profiles") as any
    )
      .select(
        "id, username, email, display_name, avatar_url, is_deactivated, created_at, updated_at"
      )
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      return notFound("User");
    }

    const profile = profileData as ProfileRow;

    // Fetch all related data in parallel
    const [
      leaderboardResult,
      cardsResult,
      challengesResult,
      achievementsResult,
      friendCountResult,
    ] = await Promise.all([
      // Leaderboard stats
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("leaderboard_entries") as any)
        .select(
          "total_cards, total_correct_picks, total_attempted_picks, win_rate, current_streak, best_streak, daily_streak, best_daily_streak, h2h_wins, h2h_losses, h2h_win_pct"
        )
        .eq("user_id", userId)
        .single(),

      // Recent cards (last 20)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("cards") as any)
        .select(
          "id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),

      // Recent challenges (last 20) with profile joins for opponent info
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("challenges") as any)
        .select(
          "id, challenger_id, opponent_id, status, game_mode, winner_id, resolved_at, created_at, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name)"
        )
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20),

      // Achievements with achievement details
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("user_achievements") as any)
        .select(
          "id, unlocked_at, achievement:achievements!inner(id, name, description, icon, tier, category)"
        )
        .eq("user_id", userId),

      // Friend count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.from("friendships") as any)
        .select("*", { count: "exact", head: true })
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
        .eq("status", "accepted"),
    ]);

    // Map leaderboard to stats (default to zeros if no entry)
    const lb = leaderboardResult.data as LeaderboardRow | null;
    const stats: AdminUserDetail["stats"] = {
      totalCards: lb?.total_cards ?? 0,
      totalCorrectPicks: lb?.total_correct_picks ?? 0,
      totalAttemptedPicks: lb?.total_attempted_picks ?? 0,
      winRate: lb?.win_rate ?? 0,
      currentStreak: lb?.current_streak ?? 0,
      bestStreak: lb?.best_streak ?? 0,
      dailyStreak: lb?.daily_streak ?? 0,
      bestDailyStreak: lb?.best_daily_streak ?? 0,
      h2hWins: lb?.h2h_wins ?? 0,
      h2hLosses: lb?.h2h_losses ?? 0,
      h2hWinPct: lb?.h2h_win_pct ?? 0,
    };

    // Map recent cards to camelCase
    const cards = (cardsResult.data as CardRow[] | null) ?? [];
    const recentCards: AdminUserDetail["recentCards"] = cards.map((card) => ({
      id: card.id,
      status: card.status,
      score: card.score,
      totalPicks: card.total_picks,
      cardSize: card.card_size,
      gameMode: card.game_mode,
      lockedAt: card.locked_at,
      resolvedAt: card.resolved_at,
      createdAt: card.created_at,
    }));

    // Map recent challenges — determine opponent based on userId
    const challenges =
      (challengesResult.data as ChallengeRow[] | null) ?? [];
    const recentChallenges: AdminUserDetail["recentChallenges"] =
      challenges.map((ch) => {
        const isChallenger = ch.challenger_id === userId;
        const opponentProfile = isChallenger ? ch.opponent : ch.challenger;
        return {
          id: ch.id,
          opponentUsername: opponentProfile?.username ?? "Unknown",
          opponentDisplayName: opponentProfile?.display_name ?? null,
          status: ch.status,
          gameMode: ch.game_mode,
          winnerId: ch.winner_id,
          createdAt: ch.created_at,
          resolvedAt: ch.resolved_at ?? null,
        };
      });

    // Map achievements
    const userAchievements =
      (achievementsResult.data as AchievementRow[] | null) ?? [];
    const achievements: AdminUserDetail["achievements"] =
      userAchievements.map((ua) => ({
        id: ua.achievement.id,
        name: ua.achievement.name,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        tier: ua.achievement.tier,
        category: ua.achievement.category,
        unlockedAt: ua.unlocked_at,
      }));

    const result: AdminUserDetail = {
      profile: {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        displayName: profile.display_name,
        avatarUrl: profile.avatar_url,
        isDeactivated: profile.is_deactivated,
        signupDate: profile.created_at,
        updatedAt: profile.updated_at,
      },
      stats,
      recentCards,
      recentChallenges,
      achievements,
      friendCount: friendCountResult.count ?? 0,
    };

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=30",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch user detail");
  }
}
