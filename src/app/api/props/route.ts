import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError } from "@/lib/api/errors";
import type { Game, Prop, StatCategory } from "@/lib/supabase/types";

const LOCK_BUFFER_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as StatCategory | null;
    const sport = searchParams.get("sport");

    // Only return games that haven't locked yet (5-minute buffer before tip-off)
    const lockCutoff = new Date(Date.now() + LOCK_BUFFER_MS).toISOString();
    const tomorrowEnd = new Date();
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
    tomorrowEnd.setHours(11, 59, 59, 999);

    // Fetch games with their props — only upcoming (not started)
    let query = supabase
      .from("games")
      .select("*, props(*)")
      .gte("commence_time", lockCutoff)
      .lte("commence_time", tomorrowEnd.toISOString())
      .order("commence_time", { ascending: true });

    if (sport) {
      query = query.eq("sport", sport);
    }

    const result = await query;

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
    return handleApiError(error, "Failed to fetch props");
  }
}
