import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, notFound, handleApiError } from "@/lib/api/errors";
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
      return unauthorized();
    }

    const { id } = await context.params;

    // Fetch the card
    const cardResult = await (supabase.from("cards") as any)
      .select("*")
      .eq("id", id)
      .single();

    if (cardResult.error || !cardResult.data) {
      return notFound("Card");
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
      return badRequest("Only resolved cards can be shared");
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
      .select("*, props(player_name, player_id, stat_category, line)")
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
    return handleApiError(error, "Failed to generate share link");
  }
}
