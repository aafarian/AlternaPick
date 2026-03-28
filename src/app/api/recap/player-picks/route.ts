import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import { typedFrom } from "@/lib/supabase/typed-queries";

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
    if (!playerName) {
      return NextResponse.json(
        { error: "playerName query parameter is required" },
        { status: 400 },
      );
    }

    const statCategory = request.nextUrl.searchParams.get("statCategory");
    const from = request.nextUrl.searchParams.get("from"); // ISO date, e.g. "2026-03-21"
    const to = request.nextUrl.searchParams.get("to"); // ISO date, e.g. "2026-03-27"
    const supabase = createAdminClient();

    // Find all props for this player (optionally filtered by stat category)
    let propsQuery = typedFrom(supabase, "props")
      .select("id, player_name, stat_category, line, games(sport)")
      .eq("player_name", playerName);
    if (statCategory) {
      propsQuery = propsQuery.eq("stat_category", statCategory);
    }
    const { data: props, error: propsError } = await propsQuery;

    if (propsError) {
      throw new Error(`Failed to fetch props: ${propsError.message}`);
    }
    if (!props || props.length === 0) {
      return NextResponse.json({ playerName, props: [] });
    }

    const propIds = (props as Array<{ id: string }>).map((p) => p.id);

    // When a date range is provided, first resolve which card IDs fall within it.
    // PostgREST embedded-resource filters don't exclude parent rows, so we need
    // a two-step approach: find eligible cards, then filter picks by card_id.
    let cardIdFilter: string[] | null = null;

    if (from || to) {
      let cardsQuery = typedFrom(supabase, "cards")
        .select("id")
        .eq("status", "resolved");

      if (from) {
        cardsQuery = cardsQuery.gte("resolved_at", `${from}T00:00:00Z`);
      }
      if (to) {
        const toDate = new Date(`${to}T00:00:00Z`);
        toDate.setUTCDate(toDate.getUTCDate() + 1);
        cardsQuery = cardsQuery.lt("resolved_at", toDate.toISOString());
      }

      const { data: cardRows, error: cardsError } = await cardsQuery;
      if (cardsError) {
        throw new Error(`Failed to fetch cards for date range: ${cardsError.message}`);
      }
      cardIdFilter = ((cardRows ?? []) as { id: string }[]).map((c) => c.id);

      // No cards in range — nothing to show
      if (cardIdFilter.length === 0) {
        return NextResponse.json({ playerName, props: [] });
      }
    }

    // Fetch non-pending picks for these props
    let picksQuery = typedFrom(supabase, "picks")
      .select(
        "prop_id, card_id, selection, result, actual_value, cards!picks_card_id_fkey(user_id, profiles:profiles!cards_user_id_fkey(username))",
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
    const picksByProp = new Map<string, Array<Record<string, unknown>>>();
    for (const pick of (picks ?? []) as Array<Record<string, unknown>>) {
      const propId = pick.prop_id as string;
      if (!picksByProp.has(propId)) picksByProp.set(propId, []);
      picksByProp.get(propId)!.push(pick);
    }

    // Build response grouped by prop
    const propResults: PropResult[] = (props as Array<Record<string, unknown>>)
      .filter((p) => picksByProp.has(p.id as string))
      .map((p) => {
        const propPicks = picksByProp.get(p.id as string) ?? [];
        const game = p.games as { sport: string } | null;
        const pickers: PickerResult[] = propPicks.map((pick) => {
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
        const hits = pickers.filter((pk) => pk.result === "hit").length;
        return {
          propId: p.id as string,
          statCategory: p.stat_category as string,
          line: p.line as number,
          sport: game?.sport ?? "unknown",
          hitRate: pickers.length > 0 ? hits / pickers.length : 0,
          pickCount: pickers.length,
          actualValue: pickers.find((pk) => pk.actualValue != null)?.actualValue ?? null,
          pickers,
        };
      })
      .sort((a, b) => b.pickCount - a.pickCount);

    return NextResponse.json({ playerName, props: propResults });
  } catch (error) {
    return handleApiError(error, "Failed to fetch player picks");
  }
}
