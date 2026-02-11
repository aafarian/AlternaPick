import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, notFound, forbidden, conflict, serverError, handleApiError } from "@/lib/api/errors";
import type { Card, Challenge, Pick, PickSelection } from "@/lib/supabase/types";

interface CreatePickInput {
  prop_id: string;
  selection: PickSelection;
}

interface CreateCardBody {
  picks: CreatePickInput[];
  anon_id?: string;
  challenge_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCardBody;
    const { picks, anon_id, challenge_id } = body;

    // Validate pick count
    if (!picks || picks.length !== 6) {
      return badRequest("Exactly 6 picks are required");
    }

    // Check for duplicate prop_ids
    const propIds = picks.map((p) => p.prop_id);
    if (new Set(propIds).size !== propIds.length) {
      return badRequest("Duplicate prop selections are not allowed");
    }

    // Validate selections
    for (const pick of picks) {
      if (pick.selection !== "over" && pick.selection !== "under") {
        return badRequest(`Invalid selection: ${pick.selection}`);
      }
    }

    const supabase = await createClient();

    // Get current user (may be null for anonymous users)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Challenge-linked card validation
    if (challenge_id) {
      if (!user) {
        return unauthorized();
      }

      // Fetch the challenge
      const challengeResult = await (supabase.from("challenges") as any)
        .select("*")
        .eq("id", challenge_id)
        .single();

      if (challengeResult.error || !challengeResult.data) {
        return notFound("Challenge");
      }

      const challenge = challengeResult.data as Challenge;

      // Validate user is a participant
      if (
        challenge.challenger_id !== user.id &&
        challenge.opponent_id !== user.id
      ) {
        return forbidden("You are not a participant in this challenge");
      }

      // Validate challenge status
      if (challenge.status !== "accepted" && challenge.status !== "active") {
        return badRequest("Challenge is not in a valid state for card creation");
      }

      // Check if user already has a card for this challenge
      const existingCardResult = await (supabase.from("cards") as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("challenge_id", challenge_id)
        .limit(1);

      if (existingCardResult.error) {
        return serverError("Failed to check existing cards", existingCardResult.error.message);
      }

      const existingCards = (existingCardResult.data ?? []) as { id: string }[];
      if (existingCards.length > 0) {
        return conflict("You already have a card for this challenge");
      }
    }

    // Verify all props exist
    const propsResult = await supabase
      .from("props")
      .select("id")
      .in("id", propIds);

    if (propsResult.error) {
      return serverError("Failed to verify props", propsResult.error.message);
    }

    const existingProps = (propsResult.data ?? []) as { id: string }[];

    if (existingProps.length !== propIds.length) {
      return badRequest("Some props not found");
    }

    // Create card with user_id if authenticated, anon_id if not
    const cardResult = await (supabase.from("cards") as any)
      .insert({
        user_id: user?.id ?? null,
        anon_id: user ? null : (anon_id ?? null),
        challenge_id: challenge_id ?? null,
        status: "locked",
        total_picks: 6,
        locked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (cardResult.error || !cardResult.data) {
      return serverError("Failed to create card", cardResult.error?.message);
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
      return serverError("Failed to create picks", picksResult.error.message);
    }

    const createdPicks = (picksResult.data ?? []) as Pick[];

    // If this is a challenge card, check if both participants now have locked cards
    // Must use admin client to bypass RLS (user can't see opponent's card)
    if (challenge_id && user) {
      const adminClient = createAdminClient();
      const allChallengeCardsResult = await (adminClient.from("cards") as any)
        .select("id, user_id, status")
        .eq("challenge_id", challenge_id)
        .eq("status", "locked");

      if (!allChallengeCardsResult.error) {
        const challengeCards = (allChallengeCardsResult.data ?? []) as {
          id: string;
          user_id: string;
          status: string;
        }[];

        // Both participants have locked cards — transition challenge to active
        if (challengeCards.length >= 2) {
          await (adminClient.from("challenges") as any)
            .update({ status: "active" })
            .eq("id", challenge_id)
            .eq("status", "accepted");
        }
      }
    }

    return NextResponse.json({
      card: { ...card, picks: createdPicks },
    });
  } catch (error) {
    return handleApiError(error, "Failed to create card");
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
      return unauthorized();
    }

    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") ?? "20", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // Scope by authenticated user (defense-in-depth with RLS)
    let query = (supabase.from("cards") as any)
      .select("id, user_id, status, score, total_picks, locked_at, resolved_at, created_at, challenge_id, picks(id, card_id, prop_id, selection, result, actual_value, created_at, props(player_name, player_id, stat_category, line, game_id))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "locked" || status === "resolved") {
      query = query.eq("status", status);
    }

    const { data: cards, error: cardsError } = await query;

    if (cardsError) {
      return serverError("Failed to fetch cards", cardsError.message);
    }

    return NextResponse.json({ cards: cards ?? [] });
  } catch (error) {
    return handleApiError(error, "Failed to fetch cards");
  }
}
