import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";

/**
 * GET /api/admin/fix-card/bulk
 *
 * Returns all locked card IDs so the frontend can call fix-card for each.
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const supabase = createAdminClient();

    const { data, error } = await (supabase.from("cards") as any)
      .select("id, user_id, picks(id, result, props(player_name, games(home_team, away_team, status, sport)))")
      .eq("status", "locked");

    if (error) {
      return NextResponse.json(
        { error: "Failed to query locked cards", detail: error.message },
        { status: 500 }
      );
    }

    type LockedCard = {
      id: string;
      user_id: string | null;
      picks: Array<{
        id: string;
        result: string;
        props: {
          player_name: string;
          games: { home_team: string; away_team: string; status: string; sport: string | null } | null;
        } | null;
      }> | null;
    };

    const cards = (data as LockedCard[] | null) ?? [];

    const summary = cards.map((card) => {
      const picks = card.picks ?? [];
      const pendingCount = picks.filter((p) => p.result === "pending").length;
      const allGamesFinal = picks.length > 0 && picks.every((p) => p.props?.games?.status === "final");
      const sports = [...new Set(picks.map((p) => p.props?.games?.sport).filter(Boolean))];
      const teams = picks.slice(0, 2).map((p) => {
        const g = p.props?.games;
        return g ? `${g.home_team} vs ${g.away_team}` : "";
      }).filter(Boolean);

      return {
        cardId: card.id,
        pendingPicks: pendingCount,
        totalPicks: picks.length,
        allGamesFinal,
        sports,
        preview: teams.join(", "),
      };
    });

    return NextResponse.json({ cards: summary, total: summary.length });
  } catch (err) {
    return handleApiError(err, "Failed to fetch locked cards");
  }
}
