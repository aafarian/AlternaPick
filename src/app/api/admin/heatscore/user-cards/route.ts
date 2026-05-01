import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { badRequest, handleApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/heatscore/user-cards?q=<search>
 *
 * Search for a user by username or email, then return their resolved cards
 * for use in the HeatScore simulator.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim();

    if (!query || query.length < 2) {
      return badRequest("Search query must be at least 2 characters");
    }

    const supabase = createAdminClient();

    // Search profiles by username or email (partial, case-insensitive)
    const { data: profiles, error: profileError } = await (
      supabase.from("profiles") as any
    )
      .select("id, username, email")
      .or(`username.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(1)
      .single();

    if (profileError || !profiles) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const profile = profiles as { id: string; username: string; email: string };

    // Fetch their resolved cards
    const { data: cardsData } = await (supabase.from("cards") as any)
      .select("id, score, total_picks, card_size, resolved_at")
      .eq("user_id", profile.id)
      .eq("status", "resolved")
      .order("resolved_at", { ascending: false })
      .limit(20);

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
      username: profile.username ?? profile.email,
      cards: cards.map((c) => ({
        id: c.id,
        score: c.score,
        totalPicks: c.total_picks,
        cardSize: c.card_size,
        resolvedAt: c.resolved_at,
      })),
    });
  } catch (error) {
    return handleApiError(error, "admin/heatscore/user-cards");
  }
}
