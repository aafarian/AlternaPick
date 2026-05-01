import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateDailyStreak } from "@/lib/streaks/engine";
import { unauthorized, badRequest, notFound, forbidden, conflict, serverError, handleApiError } from "@/lib/api/errors";
import { logError, logWarn } from "@/lib/logger";
import { isValidGameMode } from "@/lib/modes/definitions";
import { MIN_WAGER } from "@/lib/heatscore/constants";
import { validatePicksForMode } from "@/lib/modes/validation";
import { MIN_CARD_SIZE, MAX_CARD_SIZE, DEFAULT_CARD_SIZE } from "@/lib/modes/types";
import type { GameMode, PickValidationInput } from "@/lib/modes/types";
import type { Card, Challenge, Pick, PickSelection } from "@/lib/supabase/types";
import { CARD_SELECT } from "@/lib/cards/api";
import { notifyChallengeOpponent } from "@/lib/challenges/notify-opponent";
import { linkCardToParticipant } from "@/lib/challenges/queries";

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
  /** Fire Token wager for ranked solo play. Null/omitted for casual or challenges. */
  fire_token_wager?: number | null;
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
        `Invalid game_mode "${gameMode}". Must be one of: classic, sabotage, mirror, random, one_player, one_team`
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

      // Fetch the challenge via admin client — RLS only allows
      // challenger_id/opponent_id which excludes group participants.
      const adminFetch = createAdminClient();
      const challengeResult = await (adminFetch.from("challenges") as any)
        .select("*")
        .eq("id", challenge_id)
        .single();

      if (challengeResult.error || !challengeResult.data) {
        return notFound("Challenge");
      }

      const challenge = challengeResult.data as Challenge;

      // Validate user is a participant
      if (challenge.lobby_type === "group") {
        // For group challenges, check the challenge_participants table
        const { data: participantCheck } = await (adminFetch.from("challenge_participants") as any)
          .select("id")
          .eq("challenge_id", challenge_id)
          .eq("user_id", user.id)
          .limit(1);

        if (!participantCheck || (participantCheck as { id: string }[]).length === 0) {
          return forbidden("You are not a participant in this challenge");
        }
      } else if (
        challenge.challenger_id !== user.id &&
        challenge.opponent_id !== user.id
      ) {
        return forbidden("You are not a participant in this challenge");
      }

      // Enforce challenge card_size — participants must not exceed the challenge's card_size.
      // We allow fewer picks than card_size because mirror-ballot props can expire,
      // leaving fewer valid props than the challenger originally picked.
      if (challenge.card_size != null && picks.length > challenge.card_size) {
        return badRequest(
          `This challenge allows at most ${challenge.card_size} picks`
        );
      }

      // Validate challenge status
      // All participants can create cards in draft/pending/accepted/active.
      // Creating a card for a pending challenge implicitly accepts it (transition below).
      const isChallenger = challenge.challenger_id === user.id;
      const validStatuses = ["draft", "pending", "accepted", "active"];

      if (!validStatuses.includes(challenge.status)) {
        return badRequest("Challenge is not in a valid state for card creation");
      }

      // 1v1 only: opponent creating a card implicitly accepts the challenge.
      // Transition draft/pending → accepted so the challenge lifecycle continues.
      // Group challenges stay "pending" — their lifecycle is managed by
      // linkCardToParticipant / checkGroupChallengeActivation instead.
      if (!isChallenger && challenge.lobby_type !== "group" && (challenge.status === "draft" || challenge.status === "pending")) {
        const adminClient = createAdminClient();
        await (adminClient.from("challenges") as any)
          .update({ status: "accepted" })
          .eq("id", challenge_id)
          .in("status", ["draft", "pending"]);
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
        // Idempotent retry: if the card exists but the challenge is still "draft"
        // (activation failed on a previous attempt), retry the activation instead
        // of returning a hard conflict.
        if (isChallenger) {
          const { data: stuckDraft } = await (supabase.from("challenges") as any)
            .select("status, game_mode, opponent_id, message")
            .eq("id", challenge_id)
            .eq("status", "draft")
            .maybeSingle();

          if (stuckDraft) {
            const ch = stuckDraft as { status: string; game_mode: string; opponent_id: string; message: string | null };
            const adminClient = createAdminClient();
            const retryPayload: Record<string, unknown> = {
              status: "pending",
              card_size: picks.length,
            };
            if (ch.game_mode === "mirror") {
              retryPayload.mirror_props = propIds;
            }
            const { data: activated, error: retryErr } = await (adminClient.from("challenges") as any)
              .update(retryPayload)
              .eq("id", challenge_id)
              .eq("status", "draft")
              .select("id");

            if (!retryErr && (activated as { id: string }[])?.length > 0) {
              void notifyChallengeOpponent(adminClient, {
                challengeId: challenge_id,
                challengerId: user.id,
                opponentId: ch.opponent_id,
                gameMode: ch.game_mode as GameMode,
                message: ch.message,
              });
              // Activation recovered — return success so the client doesn't show an error
              return NextResponse.json({ retried: true });
            }
          }
        }
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
      const foundIds = new Set(existingProps.map((p) => p.id));
      const missingIds = propIds.filter((id) => !foundIds.has(id));
      logError("cards", `Some props not found. Requested: [${propIds.join(", ")}], Missing: [${missingIds.join(", ")}], Found: ${existingProps.length}/${propIds.length}`, "POST /api/cards");
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

    // Validate and deduct Fire Token wager (solo ranked only)
    const wager = body.fire_token_wager;
    let validatedWager: number | null = null;

    if (wager != null) {
      // Wager only allowed on solo cards (no challenge) by authenticated users
      if (challenge_id) {
        return badRequest("Token wagering is not allowed on challenges");
      }
      if (!user) {
        return badRequest("Token wagering requires authentication");
      }
      if (!Number.isInteger(wager) || wager < MIN_WAGER) {
        return badRequest(`Minimum wager is ${MIN_WAGER} tokens`);
      }

      // Deduct wager from balance. The UPDATE uses a WHERE gte clause so
      // Postgres checks the balance atomically — no race condition even if
      // two requests arrive simultaneously.
      const adminClient = createAdminClient();

      // Ensure the leaderboard row exists (new users may not have one yet).
      // The row is normally created on auth signup, but we guard defensively.
      const { data: entry } = await (adminClient.from("leaderboard_entries") as any)
        .select("fire_tokens_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!entry) {
        // Create leaderboard row for new user with starting balance minus wager
        if (1000 < wager) {
          return badRequest("Insufficient Fire Token balance");
        }
        const { error: insertErr } = await (adminClient.from("leaderboard_entries") as any)
          .insert({
            user_id: user.id,
            fire_tokens_balance: 1000 - wager,
            fire_tokens_lifetime: 0,
          });
        if (insertErr) {
          logWarn("cards", "Fire token leaderboard row creation failed", insertErr);
          return badRequest("Failed to process wager");
        }
        validatedWager = wager;
      } else {
        const currentBalance = (entry as { fire_tokens_balance: number }).fire_tokens_balance;
        if (currentBalance < wager) {
          return badRequest("Insufficient Fire Token balance");
        }

        const { data: updated, error: deductError } = await (adminClient.from("leaderboard_entries") as any)
          .update({ fire_tokens_balance: currentBalance - wager })
          .eq("user_id", user.id)
          .gte("fire_tokens_balance", wager)
          .select("fire_tokens_balance");

        if (deductError) {
          logWarn("cards", "Fire token deduction failed", deductError);
          return badRequest("Failed to process wager");
        }

        if (!updated || (updated as { fire_tokens_balance: number }[]).length === 0) {
          return badRequest("Insufficient Fire Token balance");
        }

        validatedWager = wager;
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
        ...(validatedWager != null && { fire_token_wager: validatedWager }),
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
        logError("cards", "Failed to update daily streak", undefined, streakError);
      }
    }

    // If this is a draft challenge, activate it now that the challenger has picked props.
    // Push the status filter to the DB to avoid a round-trip for non-draft challenges.
    if (challenge_id && user) {
      const { data: draftChallenge } = await (supabase.from("challenges") as any)
        .select("status, game_mode, challenger_id, opponent_id, message")
        .eq("id", challenge_id)
        .eq("status", "draft")
        .maybeSingle();

      const ch = draftChallenge as Challenge | null;
      if (ch && ch.challenger_id === user.id) {
        const adminClient = createAdminClient();

        // Activate the draft challenge now that the challenger has submitted their card.
        // Always set card_size to the challenger's actual pick count so opponents
        // are constrained to match (AP-015).
        const updatePayload: Record<string, unknown> = {
          status: "pending",
          card_size: picks.length,
        };
        if (ch.game_mode === "mirror") {
          updatePayload.mirror_props = propIds;
        }

        // Select the updated row back so we only notify when we actually performed
        // the transition (prevents duplicate notifications on concurrent retries).
        const { data: activated, error: activateErr } = await (adminClient.from("challenges") as any)
          .update(updatePayload)
          .eq("id", challenge_id)
          .eq("status", "draft")
          .select("id");

        if (activateErr) {
          logError("cards", `Failed to activate draft challenge ${challenge_id}`, undefined, activateErr);
        } else if ((activated as { id: string }[])?.length > 0 && ch.opponent_id) {
          // Only notify when we were the caller that actually performed the transition
          // (email-invite challenges have no opponent_id yet, so skip notification)
          void notifyChallengeOpponent(adminClient, {
            challengeId: challenge_id,
            challengerId: user.id,
            opponentId: ch.opponent_id,
            gameMode: ch.game_mode as GameMode,
            message: ch.message,
          });
        }
      }
    }

    // For group challenges, link the card to the participant row and check activation.
    // For 1v1, check if both participants now have locked cards.
    if (challenge_id && user) {
      const adminClient = createAdminClient();

      // Check if this is a group challenge
      const { data: challengeForLink } = await (adminClient.from("challenges") as any)
        .select("lobby_type")
        .eq("id", challenge_id)
        .single();

      const lobbyType = (challengeForLink as { lobby_type: string } | null)?.lobby_type;

      if (lobbyType === "group") {
        // Link card to participant and check if all participants are active
        await linkCardToParticipant(adminClient, challenge_id, user.id, card.id);
      } else {
        // 1v1: check if both participants now have locked cards
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
            const { error: activateError } = await (adminClient.from("challenges") as any)
              .update({ status: "active" })
              .eq("id", challenge_id)
              .in("status", ["accepted", "pending"]);

            if (activateError) {
              logError("cards", `Failed to activate challenge ${challenge_id}`, "POST /api/cards", activateError);
            }

            // Sabotage mode: swap user_id on both cards so each player
            // ends up "owning" the card their opponent built for them.
            if (gameMode === "sabotage" && challengeCards.length === 2) {
              const cardA = challengeCards[0];
              const cardB = challengeCards[1];

              // Swap user_ids via admin client (bypasses RLS)
              const { error: swapErr1 } = await (adminClient.from("cards") as any)
                .update({ user_id: cardB.user_id })
                .eq("id", cardA.id);

              const { error: swapErr2 } = await (adminClient.from("cards") as any)
                .update({ user_id: cardA.user_id })
                .eq("id", cardB.id);

              if (swapErr1 || swapErr2) {
                logError("cards", `Failed to swap sabotage cards for challenge ${challenge_id}`, "POST /api/cards", swapErr1 ?? swapErr2);
              }
            }
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
      .select(CARD_SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status === "locked" || status === "resolved") {
      query = query.eq("status", status);
    }

    // Exclude cards with no scoreable picks (all DNP/push → total_picks = 0)
    query = query.gt("total_picks", 0);

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
