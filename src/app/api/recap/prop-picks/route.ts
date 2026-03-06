import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import { typedFrom } from "@/lib/supabase/typed-queries";

export async function GET(request: NextRequest) {
  try {
    const propId = request.nextUrl.searchParams.get("propId");
    if (!propId) {
      return NextResponse.json(
        { error: "propId query parameter is required" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Fetch the prop details
    const { data: prop, error: propError } = await typedFrom(supabase, "props")
      .select("player_name, stat_category, line, games(sport)")
      .eq("id", propId)
      .maybeSingle();

    if (propError) {
      throw new Error(`Failed to fetch prop: ${propError.message}`);
    }
    if (!prop) {
      return NextResponse.json({ error: "Prop not found" }, { status: 404 });
    }

    // Fetch all resolved picks for this prop, joined with card -> profile for username
    const { data: picks, error: picksError } = await typedFrom(
      supabase,
      "picks",
    )
      .select("selection, result, actual_value, cards!picks_card_id_fkey(user_id, profiles:profiles!cards_user_id_fkey(username))")
      .eq("prop_id", propId)
      .neq("result", "pending");

    if (picksError) {
      throw new Error(`Failed to fetch picks: ${picksError.message}`);
    }

    const game = prop.games as unknown as { sport: string } | null;

    const pickers = (picks ?? []).map((pick: Record<string, unknown>) => {
      const card = pick.cards as {
        user_id: string | null;
        profiles: { username: string } | null;
      } | null;
      return {
        username: card?.profiles?.username ?? "Anonymous",
        selection: pick.selection as string,
        result: pick.result as string,
        actualValue: pick.actual_value as number | null,
      };
    });

    return NextResponse.json({
      playerName: prop.player_name,
      statCategory: prop.stat_category,
      line: prop.line,
      sport: game?.sport ?? "unknown",
      pickers,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch prop picks");
  }
}
