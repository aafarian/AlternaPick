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

    // Step 1: Find matching prop IDs from the picks table.
    // We query picks (never deleted) joined with props to find prop IDs that
    // match our filters. This avoids the old approach of querying the props
    // table directly, which fails for historical data because old props get
    // deleted when new games sync.
    const propLookup = (supabase.from("picks") as any)
      .select("prop_id, props:prop_id(player_name, player_team, stat_category)")
      .neq("result", "pending")
      .limit(2000);

    const { data: propLookupData, error: propLookupError } = await propLookup;
    if (propLookupError) {
      throw new Error(`Failed to look up props: ${propLookupError.message}`);
    }

    // Filter in JS since PostgREST embedded filters null out the join
    const matchingPropIds = new Set<string>();
    for (const row of (propLookupData ?? []) as any[]) {
      if (!row.props) continue;
      if (playerName && row.props.player_name !== playerName) continue;
      if (statCategory && row.props.stat_category !== statCategory) continue;
      if (team && row.props.player_team !== team) continue;
      matchingPropIds.add(row.prop_id);
    }

    if (matchingPropIds.size === 0) {
      return NextResponse.json({
        playerName: playerName ?? statCategory ?? team,
        props: [],
      });
    }

    const propIds = [...matchingPropIds];

    // Step 2: Find card IDs in date range (if date filter provided)
    let cardIdFilter: string[] | null = null;
    if (from || to) {
      let cardsQuery = (supabase.from("cards") as any)
        .select("id")
        .eq("status", "resolved")
        .limit(10000);

      if (from) {
        cardsQuery = cardsQuery.gte("resolved_at", `${from}T00:00:00Z`);
      }
      if (to) {
        const toDate = new Date(`${to}T00:00:00Z`);
        toDate.setUTCDate(toDate.getUTCDate() + 2);
        cardsQuery = cardsQuery.lt("resolved_at", toDate.toISOString());
      }

      const { data: cardRows, error: cardsError } = await cardsQuery;
      if (cardsError) {
        throw new Error(`Failed to fetch cards: ${cardsError.message}`);
      }
      cardIdFilter = ((cardRows ?? []) as { id: string }[]).map((c) => c.id);

      if (cardIdFilter.length === 0) {
        return NextResponse.json({
          playerName: playerName ?? statCategory ?? team,
          props: [],
        });
      }
    }

    // Step 3: Fetch full pick data for matching props (+ date-filtered cards)
    let picksQuery = (supabase.from("picks") as any)
      .select(
        "prop_id, selection, result, actual_value, " +
        "props:prop_id(id, player_name, stat_category, line, games:game_id(sport)), " +
        "cards:card_id(user_id, profiles:user_id(username))"
      )
      .in("prop_id", propIds)
      .neq("result", "pending");

    if (cardIdFilter) {
      picksQuery = picksQuery.in("card_id", cardIdFilter);
    }

    const { data: picks, error: picksError } = await picksQuery;
    if (picksError) {
      throw new Error(`Failed to fetch picks: ${picksError.message}`);
    }

    // Group picks by prop_id
    const picksByProp = new Map<string, any[]>();
    for (const pick of (picks ?? []) as any[]) {
      if (!pick.props) continue;
      const propId = pick.prop_id as string;
      if (!picksByProp.has(propId)) picksByProp.set(propId, []);
      picksByProp.get(propId)!.push(pick);
    }

    // Build response
    const propResults: PropResult[] = [];
    for (const [propId, propPicks] of picksByProp) {
      const prop = propPicks[0].props;
      const hits = propPicks.filter((p: any) => p.result === "hit").length;

      propResults.push({
        propId,
        statCategory: prop.stat_category,
        line: prop.line,
        sport: prop.games?.sport ?? "unknown",
        hitRate: propPicks.length > 0 ? hits / propPicks.length : 0,
        pickCount: propPicks.length,
        actualValue: propPicks[0]?.actual_value ?? null,
        pickers: propPicks.map((p: any) => ({
          username: p.cards?.profiles?.username ?? "Unknown",
          selection: p.selection,
          result: p.result,
          actualValue: p.actual_value,
        })),
      });
    }

    propResults.sort((a, b) => b.pickCount - a.pickCount);

    return NextResponse.json({
      playerName: playerName ?? statCategory ?? team,
      props: propResults,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch player picks");
  }
}
