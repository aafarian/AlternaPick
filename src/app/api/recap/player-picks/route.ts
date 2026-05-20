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

/**
 * Build grouped prop results from raw pick rows.
 */
function buildPropResults(picks: any[]): PropResult[] {
  const byProp = new Map<string, any[]>();
  for (const pick of picks) {
    if (!pick.props) continue;
    const pid = pick.prop_id as string;
    if (!byProp.has(pid)) byProp.set(pid, []);
    byProp.get(pid)!.push(pick);
  }

  const results: PropResult[] = [];
  for (const [pid, pp] of byProp) {
    const prop = pp[0].props;
    const hits = pp.filter((p: any) => p.result === "hit").length;
    results.push({
      propId: pid,
      statCategory: prop.stat_category,
      line: prop.line,
      sport: prop.games?.sport ?? "unknown",
      hitRate: pp.length > 0 ? hits / pp.length : 0,
      pickCount: pp.length,
      actualValue: pp[0]?.actual_value ?? null,
      pickers: pp.map((p: any) => ({
        username: p.cards?.profiles?.username ?? "Unknown",
        selection: p.selection,
        result: p.result,
        actualValue: p.actual_value,
      })),
    });
  }
  results.sort((a, b) => b.pickCount - a.pickCount);
  return results;
}

const PICK_SELECT =
  "prop_id, selection, result, actual_value, " +
  "props:prop_id(id, player_name, player_team, stat_category, line, games:game_id(sport)), " +
  "cards:card_id(user_id, profiles:user_id(username))";

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
    const label = playerName ?? statCategory ?? team;

    // Step 1: Find matching prop IDs from the props table
    let propsQuery = (supabase.from("props") as any).select("id").limit(500);
    if (playerName) propsQuery = propsQuery.eq("player_name", playerName);
    if (statCategory) propsQuery = propsQuery.eq("stat_category", statCategory);
    if (team) propsQuery = propsQuery.eq("player_team", team);

    const { data: propsData, error: propsError } = await propsQuery;
    if (propsError) throw new Error(`Failed to look up props: ${propsError.message}`);

    let propIds = ((propsData ?? []) as { id: string }[]).map((p) => p.id);

    // Fallback: if no props found, try via picks table (props may have rotated)
    if (propIds.length === 0) {
      const { data: pickPropData } = await (supabase.from("picks") as any)
        .select("prop_id, props:prop_id(player_name, player_team, stat_category)")
        .neq("result", "pending")
        .limit(5000);

      const matching = new Set<string>();
      for (const row of (pickPropData ?? []) as any[]) {
        if (!row.props) continue;
        if (playerName && row.props.player_name !== playerName) continue;
        if (statCategory && row.props.stat_category !== statCategory) continue;
        if (team && row.props.player_team !== team) continue;
        matching.add(row.prop_id);
      }
      propIds = [...matching];
    }

    if (propIds.length === 0) {
      return NextResponse.json({ playerName: label, props: [] });
    }

    // Step 2: Find card IDs in date range (if date filter provided)
    let cardIdFilter: string[] | null = null;
    if (from || to) {
      let cardsQuery = (supabase.from("cards") as any)
        .select("id")
        .eq("status", "resolved")
        .limit(10000);

      if (from) cardsQuery = cardsQuery.gte("resolved_at", `${from}T00:00:00Z`);
      if (to) {
        const toDate = new Date(`${to}T00:00:00Z`);
        toDate.setUTCDate(toDate.getUTCDate() + 2);
        cardsQuery = cardsQuery.lt("resolved_at", toDate.toISOString());
      }

      const { data: cardRows, error: cardsError } = await cardsQuery;
      if (cardsError) throw new Error(`Failed to fetch cards: ${cardsError.message}`);
      cardIdFilter = ((cardRows ?? []) as { id: string }[]).map((c) => c.id);

      if (cardIdFilter.length === 0) {
        return NextResponse.json({ playerName: label, props: [] });
      }
    }

    // For category/team queries with many prop IDs (>50), the current props
    // table has different IDs than what picks reference (props rotate on sync).
    // Query picks by card_id instead and filter by prop attributes in JS.
    if (propIds.length > 50 && cardIdFilter) {
      const { data: cardPicks } = await (supabase.from("picks") as any)
        .select(PICK_SELECT)
        .in("card_id", cardIdFilter)
        .neq("result", "pending")
        .limit(2000);

      const filtered = ((cardPicks ?? []) as any[]).filter((p) => {
        if (!p.props) return false;
        if (playerName && p.props.player_name !== playerName) return false;
        if (statCategory && p.props.stat_category !== statCategory) return false;
        if (team && p.props.player_team !== team) return false;
        return true;
      });

      return NextResponse.json({
        playerName: label,
        props: buildPropResults(filtered),
      });
    }

    // Step 3: Fetch full pick data for matching props (+ date-filtered cards)
    let picksQuery = (supabase.from("picks") as any)
      .select(PICK_SELECT)
      .in("prop_id", propIds)
      .neq("result", "pending");

    if (cardIdFilter) picksQuery = picksQuery.in("card_id", cardIdFilter);

    const { data: picks, error: picksError } = await picksQuery;
    if (picksError) throw new Error(`Failed to fetch picks: ${picksError.message}`);

    return NextResponse.json({
      playerName: label,
      props: buildPropResults((picks ?? []) as any[]),
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch player picks");
  }
}
