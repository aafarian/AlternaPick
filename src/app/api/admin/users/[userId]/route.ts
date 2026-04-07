import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, badRequest, handleApiError } from "@/lib/api/errors";
import type { AdminUserDetail } from "@/lib/admin/types";

import { isValidUuid } from "@/lib/admin/helpers";
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
  opponent_id: string | null;
  status: string;
  game_mode: GameMode;
  winner_id: string | null;
  resolved_at: string | null;
  created_at: string;
  lobby_type: "1v1" | "group" | null;
  challenger: { id: string; username: string; display_name: string | null } | null;
  opponent: { id: string; username: string; display_name: string | null } | null;
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

    if (!isValidUuid(userId)) {
      return badRequest("Invalid user ID format");
    }

    const supabase = createAdminClient();

    // Fetch profile first — return 404 if not found
     
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
       
      (supabase.from("leaderboard_entries") as any)
        .select(
          "total_cards, total_correct_picks, total_attempted_picks, win_rate, current_streak, best_streak, daily_streak, best_daily_streak, h2h_wins, h2h_losses, h2h_win_pct"
        )
        .eq("user_id", userId)
        .single(),

      // Recent cards (last 20)
       
      (supabase.from("cards") as any)
        .select(
          "id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),

      // Recent challenges (last 20) — fetches by challenger_id/opponent_id
      // (catches 1v1s and group challenges where the user is the creator).
      // We supplement this with group-participant rows below.

      (supabase.from("challenges") as any)
        .select(
          "id, challenger_id, opponent_id, status, game_mode, winner_id, resolved_at, created_at, lobby_type, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name)"
        )
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20),

      // Achievements with achievement details
       
      (supabase.from("user_achievements") as any)
        .select(
          "id, unlocked_at, achievement:achievements!inner(id, name, description, icon, tier, category)"
        )
        .eq("user_id", userId),

      // Friend count
       
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

    // Recent challenges — pulled from two sources:
    //   (a) the OR query above (1v1s + groups created by this user)
    //   (b) challenge_participants rows where the user is a non-creator member
    // We merge by id, dedupe, and supplement group challenges with participant
    // counts and (if resolved) the winner's username.
    const challengesFromFkey =
      (challengesResult.data as ChallengeRow[] | null) ?? [];

    // (b) Group-participation challenges the user is in but didn't create.
    // The OR query above misses these because challenger_id != userId.

    const { data: participantChallengeRows } = await (
      supabase.from("challenge_participants") as any
    )
      .select(
        "challenge:challenges!inner(id, challenger_id, opponent_id, status, game_mode, winner_id, resolved_at, created_at, lobby_type, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name))"
      )
      .eq("user_id", userId)
      .eq("is_creator", false)
      .order("created_at", { ascending: false })
      .limit(20);

    const challengesFromParticipant =
      ((participantChallengeRows as Array<{ challenge: ChallengeRow | null }> | null) ?? [])
        .map((r) => r.challenge)
        .filter((c): c is ChallengeRow => c !== null);

    // Dedupe by id, sort by created_at desc, take 20
    const challengeMap = new Map<string, ChallengeRow>();
    for (const ch of [...challengesFromFkey, ...challengesFromParticipant]) {
      challengeMap.set(ch.id, ch);
    }
    const challenges = Array.from(challengeMap.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 20);

    // Look up participant counts + winner usernames for any group challenges
    const groupChallengeIds = challenges
      .filter((c) => c.lobby_type === "group")
      .map((c) => c.id);

    const participantCountMap = new Map<string, number>();
    const winnerUsernameMap = new Map<string, string>();

    if (groupChallengeIds.length > 0) {

      const { data: groupParticipantRows } = await (
        supabase.from("challenge_participants") as any
      )
        .select(
          "challenge_id, user_id, user:profiles!challenge_participants_user_id_fkey(id, username)"
        )
        .in("challenge_id", groupChallengeIds);

      type GroupParticipantRow = {
        challenge_id: string;
        user_id: string | null;
        user: { id: string; username: string } | null;
      };

      for (const row of (groupParticipantRows as GroupParticipantRow[] | null) ?? []) {
        participantCountMap.set(
          row.challenge_id,
          (participantCountMap.get(row.challenge_id) ?? 0) + 1,
        );
      }

      // For winner usernames, look up by winner_id
      for (const ch of challenges) {
        if (ch.lobby_type !== "group" || !ch.winner_id) continue;
        const winnerRow = (
          (groupParticipantRows as GroupParticipantRow[] | null) ?? []
        ).find((r) => r.user_id === ch.winner_id);
        if (winnerRow?.user?.username) {
          winnerUsernameMap.set(ch.id, winnerRow.user.username);
        }
      }
    }

    const recentChallenges: AdminUserDetail["recentChallenges"] = challenges.map(
      (ch) => {
        const lobbyType: "1v1" | "group" =
          ch.lobby_type === "group" ? "group" : "1v1";

        if (lobbyType === "group") {
          return {
            id: ch.id,
            lobbyType,
            opponentId: null,
            opponentUsername: "Group",
            opponentDisplayName: null,
            participantCount: participantCountMap.get(ch.id) ?? null,
            winnerUsername: winnerUsernameMap.get(ch.id) ?? null,
            status: ch.status,
            gameMode: ch.game_mode,
            winnerId: ch.winner_id,
            createdAt: ch.created_at,
            resolvedAt: ch.resolved_at ?? null,
          };
        }

        // 1v1
        const isChallenger = ch.challenger_id === userId;
        const opponentProfile = isChallenger ? ch.opponent : ch.challenger;
        const opponentId = isChallenger ? ch.opponent_id : ch.challenger_id;

        // Winner username for 1v1: pick from challenger/opponent
        let winnerUsername: string | null = null;
        if (ch.winner_id) {
          if (ch.winner_id === ch.challenger?.id) winnerUsername = ch.challenger.username;
          else if (ch.winner_id === ch.opponent?.id) winnerUsername = ch.opponent.username;
        }

        return {
          id: ch.id,
          lobbyType,
          opponentId,
          opponentUsername: opponentProfile?.username ?? "Unknown",
          opponentDisplayName: opponentProfile?.display_name ?? null,
          participantCount: null,
          winnerUsername,
          status: ch.status,
          gameMode: ch.game_mode,
          winnerId: ch.winner_id,
          createdAt: ch.created_at,
          resolvedAt: ch.resolved_at ?? null,
        };
      }
    );

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
