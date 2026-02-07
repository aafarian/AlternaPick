import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Card, Pick, PickSelection } from "@/lib/supabase/types";

interface CreatePickInput {
  prop_id: string;
  selection: PickSelection;
}

interface CreateCardBody {
  picks: CreatePickInput[];
  anon_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCardBody;
    const { picks, anon_id } = body;

    // Validate pick count
    if (!picks || picks.length !== 6) {
      return NextResponse.json(
        { error: "Exactly 6 picks are required" },
        { status: 400 }
      );
    }

    // Check for duplicate prop_ids
    const propIds = picks.map((p) => p.prop_id);
    if (new Set(propIds).size !== propIds.length) {
      return NextResponse.json(
        { error: "Duplicate prop selections are not allowed" },
        { status: 400 }
      );
    }

    // Validate selections
    for (const pick of picks) {
      if (pick.selection !== "over" && pick.selection !== "under") {
        return NextResponse.json(
          { error: `Invalid selection: ${pick.selection}` },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    // Get current user (may be null for anonymous users)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Verify all props exist
    const propsResult = await supabase
      .from("props")
      .select("id")
      .in("id", propIds);

    if (propsResult.error) {
      return NextResponse.json(
        { error: "Failed to verify props", message: propsResult.error.message },
        { status: 500 }
      );
    }

    const existingProps = (propsResult.data ?? []) as { id: string }[];

    if (existingProps.length !== propIds.length) {
      const foundIds = new Set(existingProps.map((p) => p.id));
      const missing = propIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: "Some props not found", missing },
        { status: 400 }
      );
    }

    // Create card with user_id if authenticated, anon_id if not
    const cardResult = await (supabase.from("cards") as any)
      .insert({
        user_id: user?.id ?? null,
        anon_id: user ? null : (anon_id ?? null),
        status: "locked",
        total_picks: 6,
        locked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (cardResult.error || !cardResult.data) {
      return NextResponse.json(
        { error: "Failed to create card", message: cardResult.error?.message },
        { status: 500 }
      );
    }

    const card = cardResult.data as Card;

    // Create picks
    const pickInserts = picks.map((p) => ({
      card_id: card.id,
      prop_id: p.prop_id,
      selection: p.selection,
      result: "pending" as const,
    }));

    const picksResult = await (supabase.from("picks") as any)
      .insert(pickInserts)
      .select();

    if (picksResult.error) {
      return NextResponse.json(
        { error: "Failed to create picks", message: picksResult.error.message },
        { status: 500 }
      );
    }

    const createdPicks = (picksResult.data ?? []) as Pick[];

    return NextResponse.json({
      card: { ...card, picks: createdPicks },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create card", message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ cards: [] }, { status: 401 });
    }

    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // Scope by authenticated user (defense-in-depth with RLS)
    let query = (supabase.from("cards") as any)
      .select("*, picks(*, props(player_name, stat_category, line, game_id))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "locked" || status === "resolved") {
      query = query.eq("status", status);
    }

    const { data: cards, error: cardsError } = await query;

    if (cardsError) {
      return NextResponse.json(
        { error: "Failed to fetch cards", message: cardsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ cards: cards ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch cards", message },
      { status: 500 }
    );
  }
}
