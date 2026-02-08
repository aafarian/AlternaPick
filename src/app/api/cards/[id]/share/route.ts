import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Card, Pick as PickRow } from "@/lib/supabase/types";
import {
  generateShareToken,
  getShareUrl,
  getCardShareSummary,
} from "@/lib/cards/share";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient();

    // Authenticate user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    // Fetch the card
    const cardResult = await (supabase.from("cards") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (cardResult.error || !cardResult.data) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    const card = cardResult.data as Card;

    // Only the card owner can generate a share token
    if (card.user_id !== user.id) {
      return NextResponse.json(
        { error: "You can only share your own cards" },
        { status: 403 }
      );
    }

    // Only resolved cards can be shared
    if (card.status !== "resolved") {
      return NextResponse.json(
        { error: "Only resolved cards can be shared" },
        { status: 400 }
      );
    }

    // Generate token if one doesn't already exist (idempotent)
    let shareToken = card.share_token;

    if (!shareToken) {
      shareToken = generateShareToken();

      const updateResult = await (supabase.from("cards") as any)
        .update({ share_token: shareToken })
        .eq("id", id)
        .select()
        .single();

      if (updateResult.error) {
        return NextResponse.json(
          { error: "Failed to save share token", message: updateResult.error.message },
          { status: 500 }
        );
      }
    }

    // Fetch picks with prop details for the summary
    const picksResult = await (supabase.from("picks") as any)
      .select("*, props(player_name, stat_category, line)")
      .eq("card_id", id);

    if (picksResult.error) {
      return NextResponse.json(
        { error: "Failed to fetch picks", message: picksResult.error.message },
        { status: 500 }
      );
    }

    const picks = (picksResult.data ?? []) as (PickRow & {
      props?: { player_name: string; stat_category: string; line: number } | null;
    })[];

    const shareUrl = getShareUrl(shareToken);
    const summary = getCardShareSummary(card.score, card.total_picks, picks, shareUrl);

    return NextResponse.json({
      share_token: shareToken,
      share_url: shareUrl,
      summary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate share link", message },
      { status: 500 }
    );
  }
}
