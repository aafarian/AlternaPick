import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken, markTokenUsed } from "@/lib/challenges/guest-token";
import { badRequest, serverError, handleApiError } from "@/lib/api/errors";
import { logError } from "@/lib/logger";
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
      logError("guest-pick", "Invalid or expired guest token", "POST /api/challenges/[id]/guest-pick");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Verify token's challenge_id matches the URL parameter
    if (tokenData.challengeId !== challengeId) {
      logError("guest-pick", `Token challenge_id mismatch: token=${tokenData.challengeId}, url=${challengeId}`, "POST /api/challenges/[id]/guest-pick");
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
      logError("guest-pick", `Challenge ${challengeId} already has an opponent`, "POST /api/challenges/[id]/guest-pick");
      return badRequest("Challenge already has an opponent");
    }

    // Verify challenge is not cancelled/expired/resolved/declined
    const invalidStatuses = ["cancelled", "declined", "resolved"];
    if (invalidStatuses.includes(challenge.status)) {
      logError("guest-pick", `Challenge ${challengeId} is ${challenge.status}`, "POST /api/challenges/[id]/guest-pick");
      return badRequest(`Challenge is ${challenge.status}`);
    }

    // Validate pick count matches challenge card_size
    if (picks.length !== challenge.card_size) {
      return badRequest(`Exactly ${challenge.card_size} picks are required`);
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

    // Verify all props exist
    const { data: propsData, error: propsError } = await (admin.from("props") as any)
      .select("id")
      .in("id", propIds);

    if (propsError) {
      logError("guest-pick", "Failed to verify props", "POST /api/challenges/[id]/guest-pick", propsError);
      return serverError("Failed to verify props", propsError.message);
    }

    const existingProps = (propsData ?? []) as { id: string }[];
    if (existingProps.length !== propIds.length) {
      const foundIds = new Set(existingProps.map((p) => p.id));
      const missingIds = propIds.filter((id) => !foundIds.has(id));
      logError("guest-pick", `Some props not found. Missing: [${missingIds.join(", ")}]`, "POST /api/challenges/[id]/guest-pick");
      return badRequest("Some props not found");
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

    // Create card for guest (user_id: null)
    const { data: cardData, error: cardError } = await (admin.from("cards") as any)
      .insert({
        user_id: null,
        challenge_id: challengeId,
        status: "locked",
        total_picks: challenge.card_size,
        card_size: challenge.card_size,
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
      logError("guest-pick", "Failed to create guest picks", "POST /api/challenges/[id]/guest-pick", picksError);
      return serverError("Failed to create picks", picksError.message);
    }

    const createdPicks = (picksData ?? []) as Pick[];

    // Mark token as used
    await markTokenUsed(token);

    return NextResponse.json({
      card: { ...card, picks: createdPicks },
    });
  } catch (error) {
    return handleApiError(error, "Failed to submit guest picks");
  }
}
