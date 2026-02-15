import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDailyStreak } from "@/lib/streaks/engine";
import { unauthorized, badRequest, notFound, forbidden, conflict, serverError, handleApiError } from "@/lib/api/errors";
import { isValidGameMode } from "@/lib/modes/definitions";
import { validatePicksForMode } from "@/lib/modes/validation";
import { MIN_CARD_SIZE, MAX_CARD_SIZE, DEFAULT_CARD_SIZE } from "@/lib/modes/types";
import type { GameMode, PickValidationInput } from "@/lib/modes/types";
import type { Card, Challenge, Pick, PickSelection } from "@/lib/supabase/types";

interface CreatePickInput {
  prop_id: string;
  selection: PickSelection;
}

interface CreateCardBody {
  picks: CreatePickInput[];
  anon_id?: string;
  challenge_id?: string;
  game_mode?: string;
  card_size?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateCardBody;
    const { picks, anon_id, challenge_id } = body;

    // Resolve game_mode and card_size with backward-compatible defaults
    const gameMode: string = body.game_mode ?? "classic";
    const cardSize: number = body.card_size ?? DEFAULT_CARD_SIZE;

    // Validate game_mode
    if (!isValidGameMode(gameMode)) {
      return badRequest(
        `Invalid game_mode "${gameMode}". Must be one of: classic, sabotage, mirror, one_player, one_team`
      );
    }

    // Validate card_size range (2-6)
    if (
      !Number.isInteger(cardSize) ||
      cardSize < MIN_CARD_SIZE ||
      cardSize > MAX_CARD_SIZE
    ) {
      return badRequest(
        `card_size must be an integer between ${MIN_CARD_SIZE} and ${MAX_CARD_SIZE}`
      );
    }

    // Validate pick count matches card_size
    if (!picks || picks.length !== cardSize) {
      return badRequest(`Exactly ${cardSize} picks are required`);
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
      // The challenger can lock in their card while the challenge is still "pending"
      // (they create the challenge + card in one step).
      // The opponent can only create a card after accepting (status = "accepted" or "active").
      const isChallenger = challenge.challenger_id === user.id;
      const validStatuses = isChallenger
        ? ["pending", "accepted", "active"]
        : ["accepted", "active"];

      if (!validStatuses.includes(challenge.status)) {
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

    // Verify all props exist (also fetch player_name and player_team for mode validation)
    const propsResult = await (supabase.from("props") as any)
      .select("id, player_name, player_team")
      .in("id", propIds);

    if (propsResult.error) {
      return serverError("Failed to verify props", propsResult.error.message);
    }

    const existingProps = (propsResult.data ?? []) as {
      id: string;
      player_name: string;
      player_team: string | null;
    }[];

    if (existingProps.length !== propIds.length) {
      return badRequest("Some props not found");
    }

    // Validate picks against mode constraints (one_player, one_team, etc.)
    if (gameMode !== "classic") {
      // Build a lookup from prop_id -> prop details
      const propLookup = new Map(existingProps.map((p) => [p.id, p]));

      const validationInputs: PickValidationInput[] = picks.map((pick) => {
        const prop = propLookup.get(pick.prop_id)!;
        return {
          player_name: prop.player_name,
          player_team: prop.player_team ?? "",
        };
      });

      const modeValidation = validatePicksForMode(
        validationInputs,
        gameMode as GameMode
      );
      if (!modeValidation.valid) {
        return badRequest(modeValidation.error ?? "Picks violate mode constraints");
      }
    }

    // Create card with user_id if authenticated, anon_id if not
    const cardResult = await (supabase.from("cards") as any)
      .insert({
        user_id: user?.id ?? null,
        anon_id: user ? null : (anon_id ?? null),
        challenge_id: challenge_id ?? null,
        status: "locked",
        total_picks: cardSize,
        card_size: cardSize,
        game_mode: gameMode,
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

    // Fire-and-forget: update daily streak on card lock (authenticated users only)
    if (user) {
      try {
        const adminClient = createAdminClient();
        await updateDailyStreak(adminClient, user.id);
      } catch (streakError) {
        console.error("Failed to update daily streak:", streakError);
      }
    }

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

          // Sabotage mode: swap user_id on both cards so each player
          // ends up "owning" the card their opponent built for them.
          if (gameMode === "sabotage" && challengeCards.length === 2) {
            const cardA = challengeCards[0];
            const cardB = challengeCards[1];

            // Swap user_ids via admin client (bypasses RLS)
            await (adminClient.from("cards") as any)
              .update({ user_id: cardB.user_id })
              .eq("id", cardA.id);

            await (adminClient.from("cards") as any)
              .update({ user_id: cardA.user_id })
              .eq("id", cardB.id);
          }
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
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const cursor = searchParams.get("cursor"); // ISO date string (created_at of last item)

    // Scope by authenticated user (defense-in-depth with RLS)
    let query = (supabase.from("cards") as any)
      .select("id, user_id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at, challenge_id, picks(id, card_id, prop_id, selection, result, actual_value, created_at, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(sport)))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "locked" || status === "resolved") {
      query = query.eq("status", status);
    }

    // Cursor-based pagination: fetch cards older than the cursor
    if (cursor) {
      query = query.lt("created_at", cursor);
    }

    const { data: cards, error: cardsError } = await query;

    if (cardsError) {
      return serverError("Failed to fetch cards", cardsError.message);
    }

    const cardsList = (cards ?? []) as { created_at: string }[];
    const nextCursor =
      cardsList.length === limit
        ? cardsList[cardsList.length - 1].created_at
        : null;

    return NextResponse.json({
      cards: cardsList,
      next_cursor: nextCursor,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch cards");
  }
}
