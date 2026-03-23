import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken, markTokenUsed } from "@/lib/challenges/guest-token";
import { badRequest, serverError, handleApiError } from "@/lib/api/errors";
import { logError, logWarn } from "@/lib/logger";
import { UNPICKABLE_CHALLENGE_STATUSES, LOCK_BUFFER_MS } from "@/lib/challenges/constants";
import type { Card, Challenge, Pick, PickSelection } from "@/lib/supabase/types";

interface GuestPickInput {
  prop_id: string;
  selection: PickSelection;
}

interface GuestPickBody {
  token: string;
  picks: GuestPickInput[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: challengeId } = await params;
    const body = (await request.json()) as GuestPickBody;
    const { token, picks } = body;

    // Validate required fields
    if (!token || typeof token !== "string") {
      return badRequest("Token is required");
    }

    if (!picks || !Array.isArray(picks) || picks.length === 0) {
      return badRequest("Picks are required");
    }

    // Verify guest token
    const tokenData = await verifyGuestToken(token);
    if (!tokenData) {
      logWarn("guest-pick", "Invalid or expired guest token");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Verify token's challenge_id matches the URL parameter
    if (tokenData.challengeId !== challengeId) {
      logWarn("guest-pick", `Token challenge_id mismatch: token=${tokenData.challengeId}, url=${challengeId}`);
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const admin = createAdminClient();

    // Fetch the challenge
    const { data: challengeData, error: challengeError } = await (admin.from("challenges") as any)
      .select("*")
      .eq("id", challengeId)
      .single();

    if (challengeError || !challengeData) {
      logError("guest-pick", `Challenge not found: ${challengeId}`, "POST /api/challenges/[id]/guest-pick", challengeError);
      return badRequest("Challenge not found");
    }

    const challenge = challengeData as Challenge;

    // Verify challenge has null opponent_id (email invite challenge)
    if (challenge.opponent_id !== null) {
      logWarn("guest-pick", `Challenge ${challengeId} already has an opponent`);
      return badRequest("Challenge already has an opponent");
    }

    // Verify challenge is not cancelled/expired/resolved/declined
    if (UNPICKABLE_CHALLENGE_STATUSES.includes(challenge.status as typeof UNPICKABLE_CHALLENGE_STATUSES[number])) {
      logWarn("guest-pick", `Challenge ${challengeId} is ${challenge.status}`);
      return badRequest(`Challenge is ${challenge.status}`);
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

    const now = Date.now();
    const hasMirrorProps = challenge.mirror_props && challenge.mirror_props.length > 0;

    if (hasMirrorProps) {
      // Mirror/random mode: validate picks against non-started mirror_props.
      // Props may expire between page load and submission — the guest should only
      // be required to pick on props whose games haven't started yet.
      const { data: mirrorPropsData, error: mirrorPropsError } = await (admin.from("props") as any)
        .select("id, games(commence_time)")
        .in("id", challenge.mirror_props);

      if (mirrorPropsError) {
        logError("guest-pick", "Failed to fetch mirror props", "POST /api/challenges/[id]/guest-pick", mirrorPropsError);
        return serverError("Failed to verify props", mirrorPropsError.message);
      }

      const mirrorProps = (mirrorPropsData ?? []) as Array<{ id: string; games: { commence_time: string } | null }>;
      const validPropIds = new Set(
        mirrorProps
          .filter((p) => p.games && new Date(p.games.commence_time).getTime() - now > LOCK_BUFFER_MS)
          .map((p) => p.id)
      );

      if (validPropIds.size === 0) {
        return badRequest("All props on this challenge have expired");
      }

      // Every submitted pick must be for a valid (non-started) mirror prop
      for (const pick of picks) {
        if (!validPropIds.has(pick.prop_id)) {
          return badRequest(`Prop ${pick.prop_id} is not a valid pickable prop for this challenge`);
        }
      }

      // Guest must pick on ALL valid (non-started) props
      if (picks.length !== validPropIds.size) {
        return badRequest(`Exactly ${validPropIds.size} picks are required (${validPropIds.size} props available)`);
      }
    } else {
      // Classic/sabotage/one_player/one_team: guest picks their own props.
      // Validate that all submitted props exist and haven't started.
      const propIds = picks.map((p) => p.prop_id);

      const { data: propsData, error: propsError } = await (admin.from("props") as any)
        .select("id, games(commence_time)")
        .in("id", propIds);

      if (propsError) {
        logError("guest-pick", "Failed to fetch props for guest pick", "POST /api/challenges/[id]/guest-pick", propsError);
        return serverError("Failed to verify props", propsError.message);
      }

      const fetchedProps = (propsData ?? []) as Array<{ id: string; games: { commence_time: string } | null }>;
      if (fetchedProps.length !== propIds.length) {
        return badRequest("One or more props not found");
      }

      // Check all props are still pickable (haven't started)
      for (const prop of fetchedProps) {
        if (!prop.games || new Date(prop.games.commence_time).getTime() - now <= LOCK_BUFFER_MS) {
          return badRequest(`Prop ${prop.id} has already started or is about to start`);
        }
      }

      // Enforce card_size — guest must submit exactly the right number of picks
      const expectedSize = challenge.card_size ?? 6;
      if (picks.length < 2 || picks.length > expectedSize) {
        return badRequest(`Expected between 2 and ${expectedSize} picks`);
      }
    }

    // Check if a guest card already exists for this challenge (prevent duplicates)
    const { data: existingCards, error: existingError } = await (admin.from("cards") as any)
      .select("id")
      .eq("challenge_id", challengeId)
      .is("user_id", null)
      .limit(1);

    if (existingError) {
      logError("guest-pick", "Failed to check existing guest cards", "POST /api/challenges/[id]/guest-pick", existingError);
      return serverError("Failed to check existing cards", existingError.message);
    }

    if ((existingCards ?? []).length > 0) {
      return badRequest("A guest card already exists for this challenge");
    }

    // Atomically claim the token. If another request already consumed it,
    // bail out with 409 to prevent duplicate guest cards.
    const claimed = await markTokenUsed(token);
    if (!claimed) {
      return NextResponse.json(
        { error: "This invite link has already been used" },
        { status: 409 },
      );
    }

    // Create card for guest (user_id: null)
    // Use picks.length (validated above) — may be less than card_size if some props expired.
    const { data: cardData, error: cardError } = await (admin.from("cards") as any)
      .insert({
        user_id: null,
        challenge_id: challengeId,
        status: "locked",
        total_picks: picks.length,
        card_size: picks.length,
        game_mode: challenge.game_mode,
        locked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (cardError || !cardData) {
      logError("guest-pick", "Failed to create guest card", "POST /api/challenges/[id]/guest-pick", cardError);
      return serverError("Failed to create card", cardError?.message);
    }

    const card = cardData as Card;

    // Create picks
    const pickInserts = picks.map((p) => ({
      card_id: card.id,
      prop_id: p.prop_id,
      selection: p.selection,
      result: "pending" as const,
    }));

    const { data: picksData, error: picksError } = await (admin.from("picks") as any)
      .insert(pickInserts)
      .select();

    if (picksError) {
      // Delete the orphaned card so the challenge isn't permanently stuck.
      // The token is already consumed, but at least the challenge state is clean.
      await (admin.from("cards") as any).delete().eq("id", card.id);
      logError("guest-pick", "Failed to create guest picks — orphaned card deleted", "POST /api/challenges/[id]/guest-pick", picksError);
      return serverError("Failed to create picks", picksError.message);
    }

    const createdPicks = (picksData ?? []) as Pick[];

    // Check if both participants now have locked cards (challenger + guest).
    // If so, transition the challenge to "active" so it can be resolved.
    const { data: allCards, error: allCardsError } = await (admin.from("cards") as any)
      .select("id")
      .eq("challenge_id", challengeId)
      .eq("status", "locked");

    if (allCardsError) {
      logError("guest-pick", "Failed to check challenge cards", "POST /api/challenges/[id]/guest-pick", allCardsError);
    } else if ((allCards ?? []).length >= 2) {
      const { error: activateError } = await (admin.from("challenges") as any)
        .update({ status: "active" })
        .eq("id", challengeId)
        .in("status", ["accepted", "pending"]);

      if (activateError) {
        logError("guest-pick", `Failed to activate challenge ${challengeId}`, "POST /api/challenges/[id]/guest-pick", activateError);
      }
    }

    return NextResponse.json({
      card: { ...card, picks: createdPicks },
    });
  } catch (error) {
    return handleApiError(error, "Failed to submit guest picks");
  }
}
