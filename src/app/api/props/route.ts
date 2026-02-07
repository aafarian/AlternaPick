import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Game, Prop, StatCategory } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as StatCategory | null;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(now);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(11, 59, 59, 999);

    // Fetch games with their props
    const result = await supabase
      .from("games")
      .select("*, props(*)")
      .gte("commence_time", todayStart.toISOString())
      .lte("commence_time", tomorrowEnd.toISOString())
      .order("commence_time", { ascending: true });

    const games = (result.data ?? []) as (Game & { props: Prop[] })[];

    // Filter props by category if specified
    const filtered = games.map((game) => ({
      ...game,
      props: game.props
        .filter((p) => !category || p.stat_category === category)
        .sort((a, b) => a.player_name.localeCompare(b.player_name)),
    }));

    // Remove games with no props after filtering
    const withProps = filtered.filter((g) => g.props.length > 0);

    return NextResponse.json({ games: withProps });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch props", message },
      { status: 500 }
    );
  }
}
