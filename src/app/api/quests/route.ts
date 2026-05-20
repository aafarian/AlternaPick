import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import { QUEST_REWARDS, INDIVIDUAL_QUEST_KEYS, type QuestKey } from "@/lib/heatscore/constants";
import { logError, logInfo } from "@/lib/logger";

/**
 * GET /api/quests
 * Returns daily quest status. Auto-credits rewards for completed unclaimed quests.
 */
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = createAdminClient();
    const today = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;

    // Fetch all activity counts in parallel
    const [
      friendshipsResult,
      challengesResult,
      wagerCardsResult,
      totalCardsResult,
      claimedResult,
    ] = await Promise.all([
      // Friends added today
      (admin.from("friendships") as any)
        .select("id", { count: "exact", head: true })
        .eq("requester_id", user.id)
        .gte("created_at", todayStart),
      // Challenges created today
      (admin.from("challenges") as any)
        .select("id", { count: "exact", head: true })
        .eq("challenger_id", user.id)
        .gte("created_at", todayStart),
      // Wagered cards locked today
      (admin.from("cards") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .not("fire_token_wager", "is", null)
        .gte("locked_at", todayStart),
      // Total cards locked today
      (admin.from("cards") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("locked_at", todayStart),
      // Already claimed rewards today
      (admin.from("quest_rewards") as any)
        .select("quest_key")
        .eq("user_id", user.id)
        .eq("reward_date", today),
    ]);

    const friendsAdded = friendshipsResult.count ?? 0;
    const challengesCreated = challengesResult.count ?? 0;
    const wagerCards = wagerCardsResult.count ?? 0;
    const totalCards = totalCardsResult.count ?? 0;

    const claimed = new Set<string>(
      ((claimedResult.data ?? []) as { quest_key: string }[]).map((r) => r.quest_key),
    );

    // Compute completion status
    const completion: Record<QuestKey, boolean> = {
      add_friend: friendsAdded >= 1,
      challenge_friend: challengesCreated >= 1,
      wager_card: wagerCards >= 1,
      three_cards: totalCards >= 3,
      all_complete: false, // computed below
    };

    // Check if at least 3 individual quests are complete
    completion.all_complete = INDIVIDUAL_QUEST_KEYS.filter((k) => completion[k]).length >= 3;

    // Auto-credit rewards for completed but unclaimed quests
    const newlyClaimed: { key: QuestKey; reward: number }[] = [];
    const allKeys: QuestKey[] = [...INDIVIDUAL_QUEST_KEYS, "all_complete"];

    for (const key of allKeys) {
      if (completion[key] && !claimed.has(key)) {
        const reward = QUEST_REWARDS[key].reward;

        // Credit coins
        const { data: rpcResult, error: rpcError } = await (admin as any).rpc(
          "credit_fire_tokens",
          { p_user_id: user.id, p_amount: reward, p_include_lifetime: true },
        );

        if (rpcError || rpcResult === -1) {
          logError("quests", `Failed to credit quest reward ${key}`, "GET /api/quests", rpcError);
          continue;
        }

        // Record the claim (upsert to handle race conditions)
        const { error: insertError } = await (admin.from("quest_rewards") as any)
          .upsert(
            { user_id: user.id, quest_key: key, reward_date: today, coins_awarded: reward },
            { onConflict: "user_id,quest_key,reward_date", ignoreDuplicates: true },
          );

        if (insertError) {
          logError("quests", `Failed to record quest claim ${key}`, "GET /api/quests", insertError);
          continue;
        }

        newlyClaimed.push({ key, reward });
        claimed.add(key);
        logInfo("quests", `Auto-credited quest ${key} (+${reward}) for user ${user.id}`);
      }
    }

    // Build response
    const quests = allKeys.map((key) => ({
      key,
      label: QUEST_REWARDS[key].label,
      reward: QUEST_REWARDS[key].reward,
      completed: completion[key],
      claimed: claimed.has(key),
    }));

    const totalEarned = quests
      .filter((q) => q.claimed)
      .reduce((sum, q) => sum + q.reward, 0);

    const totalPossible = Object.values(QUEST_REWARDS).reduce((sum, q) => sum + q.reward, 0);

    // Midnight UTC reset
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    return NextResponse.json({
      quests,
      totalEarned,
      totalPossible,
      newlyClaimed,
      resetsAt: tomorrow.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch quests");
  }
}
