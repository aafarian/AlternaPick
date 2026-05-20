import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";

interface PickerResult {
  username: string;
  selection: string;
  result: string;
  actualValue: number | null;
}

interface PropResult {
  propId: string;
  statCategory: string;
  line: number;
  sport: string;
  hitRate: number;
  pickCount: number;
  actualValue: number | null;
  pickers: PickerResult[];
}

export async function GET(request: NextRequest) {
  try {
    const playerName = request.nextUrl.searchParams.get("playerName");
    const statCategory = request.nextUrl.searchParams.get("statCategory");
    const team = request.nextUrl.searchParams.get("team");
    const from = request.nextUrl.searchParams.get("from");
    const to = request.nextUrl.searchParams.get("to");

    if (!playerName && !statCategory && !team) {
      return NextResponse.json(
        { error: "playerName, statCategory, or team query parameter is required" },
        { status: 400 },
      );
    }

    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !ISO_DATE_RE.test(from)) {
      return NextResponse.json({ error: "Invalid 'from' date format" }, { status: 400 });
    }
    if (to && !ISO_DATE_RE.test(to)) {
      return NextResponse.json({ error: "Invalid 'to' date format" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Query picks directly with prop join — picks are never deleted, unlike props
    // which rotate out when new games sync. This ensures historical data is always
    // available for drill-down modals.
    let picksQuery = (supabase.from("picks") as any)
      .select(
        "prop_id, selection, result, actual_value, " +
        "props:prop_id(id, player_name, player_team, stat_category, line, games:game_id(sport)), " +
        "cards:card_id(id, user_id, resolved_at, profiles:user_id(username))"
      )
      .neq("result", "pending");

    // Apply filters via the joined props table
    if (playerName) {
      picksQuery = picksQuery.eq("props.player_name", playerName);
    }
    if (statCategory) {
      picksQuery = picksQuery.eq("props.stat_category", statCategory);
    }
    if (team) {
      picksQuery = picksQuery.eq("props.player_team", team);
    }

    // Date range filter on cards.resolved_at
    if (from) {
      picksQuery = picksQuery.gte("cards.resolved_at", `${from}T00:00:00Z`);
    }
    if (to) {
      const toDate = new Date(`${to}T00:00:00Z`);
      toDate.setUTCDate(toDate.getUTCDate() + 2);
      picksQuery = picksQuery.lt("cards.resolved_at", toDate.toISOString());
    }

    picksQuery = picksQuery.limit(500);

    const { data: rawPicks, error: picksError } = await picksQuery;
    if (picksError) {
      throw new Error(`Failed to fetch picks: ${picksError.message}`);
    }

    // Filter out picks where the embedded filter didn't exclude the parent row
    // (PostgREST returns parent rows with null embedded objects when embedded
    // filters don't match)
    const picks = ((rawPicks ?? []) as any[]).filter(
      (p) => p.props != null && p.cards != null
    );

    if (picks.length === 0) {
      return NextResponse.json({
        playerName: playerName ?? statCategory ?? team,
        props: [],
      });
    }

    // Group picks by prop_id
    const picksByProp = new Map<string, any[]>();
    for (const pick of picks) {
      const propId = pick.prop_id as string;
      if (!picksByProp.has(propId)) picksByProp.set(propId, []);
      picksByProp.get(propId)!.push(pick);
    }

    // Build response grouped by prop
    const propResults: PropResult[] = [];
    for (const [propId, propPicks] of picksByProp) {
      const firstPick = propPicks[0];
      const prop = firstPick.props;
      const hits = propPicks.filter((p: any) => p.result === "hit").length;

      const pickers: PickerResult[] = propPicks.map((p: any) => ({
        username: p.cards?.profiles?.username ?? "Unknown",
        selection: p.selection,
        result: p.result,
        actualValue: p.actual_value,
      }));

      propResults.push({
        propId,
        statCategory: prop.stat_category,
        line: prop.line,
        sport: prop.games?.sport ?? "unknown",
        hitRate: propPicks.length > 0 ? hits / propPicks.length : 0,
        pickCount: propPicks.length,
        actualValue: propPicks[0]?.actual_value ?? null,
        pickers,
      });
    }

    // Sort by pick count descending
    propResults.sort((a, b) => b.pickCount - a.pickCount);

    return NextResponse.json({
      playerName: playerName ?? statCategory ?? team,
      props: propResults,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch player picks");
  }
}
