import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Card, Challenge, Friendship } from "@/lib/supabase/types";

export interface ActivityUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CardResolvedData {
  card_id: string;
  score: number;
  total_picks: number;
}

export interface ChallengeResolvedData {
  challenge_id: string;
  winner_id: string | null;
  challenger: ActivityUser;
  opponent: ActivityUser;
  challenger_score: number;
  opponent_score: number;
}

export interface NewFriendData {
  friendship_id: string;
}

export type ActivityItem =
  | {
      type: "card_resolved";
      user: ActivityUser;
      data: CardResolvedData;
      timestamp: string;
    }
  | {
      type: "challenge_resolved";
      user: ActivityUser;
      data: ChallengeResolvedData;
      timestamp: string;
    }
  | {
      type: "new_friend";
      user: ActivityUser;
      data: NewFriendData;
      timestamp: string;
    };

/**
 * GET /api/activity
 * Returns a unified activity feed of recent friend activity.
 * Activity types: card_resolved, challenge_resolved, new_friend.
 * Limited to the last 7 days, max 20 items, sorted by timestamp desc.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Step 1: Get the user's accepted friends
    const { data: asRequester, error: err1 } = await (
      supabase.from("friendships") as any
    )
      .select("*, profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)")
      .eq("requester_id", user.id)
      .eq("status", "accepted");

    if (err1) throw new Error(err1.message);

    const { data: asAddressee, error: err2 } = await (
      supabase.from("friendships") as any
    )
      .select("*, profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url)")
      .eq("addressee_id", user.id)
      .eq("status", "accepted");

    if (err2) throw new Error(err2.message);

    // Build friend ID -> profile map, and collect recent friendships for "new_friend"
    const friendMap = new Map<string, ActivityUser>();
    const recentFriendships: Array<Friendship & { friend_profile: ActivityUser }> = [];
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    for (const row of (asRequester ?? []) as any[]) {
      const profile = row.profiles as ActivityUser;
      friendMap.set(profile.id, profile);
      const friendship = row as Friendship;
      if (friendship.updated_at >= sevenDaysAgo) {
        recentFriendships.push({ ...friendship, friend_profile: profile });
      }
    }

    for (const row of (asAddressee ?? []) as any[]) {
      const profile = row.profiles as ActivityUser;
      friendMap.set(profile.id, profile);
      const friendship = row as Friendship;
      if (friendship.updated_at >= sevenDaysAgo) {
        recentFriendships.push({ ...friendship, friend_profile: profile });
      }
    }

    const friendIds = Array.from(friendMap.keys());

    // If user has no friends, return empty feed
    if (friendIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Step 2: Fetch recent resolved cards from friends (last 7 days)
    const { data: resolvedCards, error: cardsError } = await (
      supabase.from("cards") as any
    )
      .select("id, user_id, score, total_picks, resolved_at")
      .in("user_id", friendIds)
      .eq("status", "resolved")
      .gte("resolved_at", sevenDaysAgo)
      .is("challenge_id", null)
      .order("resolved_at", { ascending: false })
      .limit(20);

    if (cardsError) throw new Error(cardsError.message);

    // Step 3: Fetch recent resolved challenges involving friends
    const { data: resolvedChallenges, error: challengesError } = await (
      supabase.from("challenges") as any
    )
      .select(
        "id, challenger_id, opponent_id, winner_id, status, resolved_at, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
      )
      .eq("status", "resolved")
      .gte("resolved_at", sevenDaysAgo)
      .or(
        friendIds
          .map((id) => `challenger_id.eq.${id},opponent_id.eq.${id}`)
          .join(",")
      )
      .order("resolved_at", { ascending: false })
      .limit(20);

    if (challengesError) throw new Error(challengesError.message);

    // Fetch scores for resolved challenge cards
    const challengeIds = ((resolvedChallenges ?? []) as any[]).map(
      (c: any) => c.id
    );

    let challengeCardScores = new Map<
      string,
      { challenger_score: number; opponent_score: number }
    >();

    if (challengeIds.length > 0) {
      const { data: challengeCards, error: ccError } = await (
        supabase.from("cards") as any
      )
        .select("id, user_id, challenge_id, score")
        .in("challenge_id", challengeIds);

      if (ccError) throw new Error(ccError.message);

      for (const ch of (resolvedChallenges ?? []) as any[]) {
        const cards = ((challengeCards ?? []) as any[]).filter(
          (c: any) => c.challenge_id === ch.id
        );
        const challengerCard = cards.find(
          (c: any) => c.user_id === ch.challenger_id
        );
        const opponentCard = cards.find(
          (c: any) => c.user_id === ch.opponent_id
        );
        challengeCardScores.set(ch.id, {
          challenger_score: challengerCard?.score ?? 0,
          opponent_score: opponentCard?.score ?? 0,
        });
      }
    }

    // Step 4: Merge into unified activity list
    const items: ActivityItem[] = [];

    // Card resolved items
    for (const card of (resolvedCards ?? []) as any[]) {
      const cardData = card as Card;
      const profile = friendMap.get(cardData.user_id ?? "");
      if (!profile) continue;
      items.push({
        type: "card_resolved",
        user: profile,
        data: {
          card_id: cardData.id,
          score: cardData.score,
          total_picks: cardData.total_picks,
        },
        timestamp: cardData.resolved_at ?? cardData.created_at,
      });
    }

    // Challenge resolved items
    for (const ch of (resolvedChallenges ?? []) as any[]) {
      const challenger = ch.challenger as ActivityUser;
      const opponent = ch.opponent as ActivityUser;
      const scores = challengeCardScores.get(ch.id) ?? {
        challenger_score: 0,
        opponent_score: 0,
      };

      // The "user" is the first friend involved (or challenger if both are friends)
      const activityUser = friendMap.has(challenger.id)
        ? challenger
        : opponent;

      items.push({
        type: "challenge_resolved",
        user: activityUser,
        data: {
          challenge_id: ch.id,
          winner_id: ch.winner_id,
          challenger,
          opponent,
          challenger_score: scores.challenger_score,
          opponent_score: scores.opponent_score,
        },
        timestamp: ch.resolved_at ?? ch.created_at,
      });
    }

    // New friend items
    for (const fs of recentFriendships) {
      items.push({
        type: "new_friend",
        user: fs.friend_profile,
        data: {
          friendship_id: fs.id,
        },
        timestamp: fs.updated_at,
      });
    }

    // Sort by timestamp desc
    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Limit to 20
    const limited = items.slice(0, 20);

    return NextResponse.json({ items: limited });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch activity feed", message },
      { status: 500 }
    );
  }
}
