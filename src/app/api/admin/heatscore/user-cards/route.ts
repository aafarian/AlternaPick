import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { badRequest, handleApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/heatscore/user-cards?q=<search>&userId=<id>
 *
 * Two modes:
 * 1. ?q=<search> — search users by username (partial, for autocomplete)
 * 2. ?userId=<id> — fetch resolved cards for a specific user
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();
    const userId = searchParams.get("userId")?.trim();

    const supabase = createAdminClient();

    // Mode 1: Search users by username
    if (query) {
      if (query.length < 2) {
        return badRequest("Search query must be at least 2 characters");
      }

      const { data: profiles } = await (supabase.from("profiles") as any)
        .select("id, username")
        .ilike("username", `%${query}%`)
        .not("username", "is", null)
        .limit(5);

      return NextResponse.json({
        users: (profiles ?? []).map((p: { id: string; username: string }) => ({
          userId: p.id,
          username: p.username,
        })),
      });
    }

    // Mode 2: Fetch cards for a specific user
    if (userId) {
      const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
        .select("id, username")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Fetch solo resolved cards (no challenge_id)
      const { data: cardsData } = await (supabase.from("cards") as any)
        .select("id, score, total_picks, card_size, challenge_id, resolved_at")
        .eq("user_id", userId)
        .eq("status", "resolved")
        .is("challenge_id", null)
        .order("resolved_at", { ascending: false })
        .limit(50);

      const cards = (
        cardsData as Array<{
          id: string;
          score: number;
          total_picks: number;
          card_size: number;
          challenge_id: string | null;
          resolved_at: string;
        }> | null
      ) ?? [];

      // Fetch resolved challenges (as challenger or opponent)
      const { data: challengesData } = await (supabase.from("challenges") as any)
        .select("id, status, winner_id, challenger_id, opponent_id, resolved_at, challenger:profiles!challenges_challenger_id_fkey(username), opponent:profiles!challenges_opponent_id_fkey(username)")
        .eq("status", "resolved")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .order("resolved_at", { ascending: false })
        .limit(50);

      const challenges = (
        challengesData as Array<{
          id: string;
          status: string;
          winner_id: string | null;
          challenger_id: string;
          opponent_id: string | null;
          resolved_at: string;
          challenger: { username: string } | null;
          opponent: { username: string } | null;
        }> | null
      ) ?? [];

      return NextResponse.json({
        userId: profile.id,
        username: profile.username ?? "(no username)",
        cards: cards.map((c) => ({
          id: c.id,
          score: c.score,
          totalPicks: c.total_picks,
          cardSize: c.card_size,
          resolvedAt: c.resolved_at,
        })),
        challenges: challenges.map((ch) => {
          const isChallenger = ch.challenger_id === userId;
          const opponentName = isChallenger ? ch.opponent?.username : ch.challenger?.username;
          const won = ch.winner_id === userId;
          const lost = ch.winner_id != null && ch.winner_id !== userId;
          return {
            id: ch.id,
            opponent: opponentName ?? "Unknown",
            result: won ? "won" : lost ? "lost" : "draw",
            resolvedAt: ch.resolved_at,
          };
        }),
      });
    }

    return badRequest("Provide either ?q=<search> or ?userId=<id>");
  } catch (error) {
    return handleApiError(error, "admin/heatscore/user-cards");
  }
}
