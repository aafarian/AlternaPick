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
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("id, username")
        .eq("id", userId)
        .single();

      if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const { data: cardsData } = await (supabase.from("cards") as any)
        .select("id, score, total_picks, card_size, resolved_at")
        .eq("user_id", userId)
        .eq("status", "resolved")
        .order("resolved_at", { ascending: false })
        .limit(100);

      const cards = (
        cardsData as Array<{
          id: string;
          score: number;
          total_picks: number;
          card_size: number;
          resolved_at: string;
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
      });
    }

    return badRequest("Provide either ?q=<search> or ?userId=<id>");
  } catch (error) {
    return handleApiError(error, "admin/heatscore/user-cards");
  }
}
