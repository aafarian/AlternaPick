import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import type { ChallengeStatus } from "@/lib/supabase/types";
import { isValidGameMode } from "@/lib/modes/definitions";
import { MIN_CARD_SIZE, MAX_CARD_SIZE } from "@/lib/modes/types";
import { typedFrom } from "@/lib/supabase/typed-queries";
import {
  getChallenges,
  createChallenge,
} from "@/lib/challenges/queries";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    let statusFilter: ChallengeStatus[] | undefined;
    if (statusParam) {
      statusFilter = statusParam.split(",").map((s) => s.trim()) as ChallengeStatus[];
      const validStatuses: ChallengeStatus[] = [
        "pending",
        "accepted",
        "declined",
        "active",
        "resolved",
        "cancelled",
      ];
      for (const s of statusFilter) {
        if (!validStatuses.includes(s)) {
          return badRequest(`Invalid status filter: ${s}`);
        }
      }
    }

    const challenges = await getChallenges(supabase, user.id, statusFilter);

    return NextResponse.json({ challenges });
  } catch (error) {
    return handleApiError(error, "Failed to fetch challenges");
  }
}

interface ChallengePostBody {
  opponent_id?: string;
  game_mode?: string;
  message?: string;
  card_size?: number;
  mirror_props?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as ChallengePostBody;

    if (!body.opponent_id) {
      return badRequest("opponent_id is required");
    }

    // ---- Validate game_mode ----
    const gameMode = body.game_mode ?? "classic";
    if (!isValidGameMode(gameMode)) {
      return badRequest(
        `Invalid game_mode: "${body.game_mode}". Must be one of: classic, sabotage, mirror, one_player, one_team`
      );
    }

    // ---- Validate message ----
    const message = body.message ?? null;
    if (message !== null && message.length > 200) {
      return badRequest("Message must be 200 characters or fewer");
    }

    // ---- Validate card_size ----
    let cardSize = body.card_size ?? 6;
    if (
      typeof cardSize !== "number" ||
      !Number.isInteger(cardSize) ||
      cardSize < MIN_CARD_SIZE ||
      cardSize > MAX_CARD_SIZE
    ) {
      return badRequest(
        `Invalid card_size: ${body.card_size}. Must be an integer between ${MIN_CARD_SIZE} and ${MAX_CARD_SIZE}`
      );
    }

    // ---- Validate mirror_props for mirror mode ----
    let mirrorProps: string[] | null = null;
    if (gameMode === "mirror") {
      if (!body.mirror_props || !Array.isArray(body.mirror_props) || body.mirror_props.length === 0) {
        return badRequest("mirror_props is required for mirror mode (array of prop IDs)");
      }

      if (body.mirror_props.length < MIN_CARD_SIZE || body.mirror_props.length > MAX_CARD_SIZE) {
        return badRequest(
          `mirror_props must contain ${MIN_CARD_SIZE}-${MAX_CARD_SIZE} prop IDs, got ${body.mirror_props.length}`
        );
      }

      // Validate that mirror_props are real prop IDs
      const { data: validProps, error: propsError } = await typedFrom(supabase, "props")
        .select("id")
        .in("id", body.mirror_props);

      if (propsError) {
        return badRequest("Failed to validate mirror props");
      }

      const validPropIds = new Set(
        ((validProps ?? []) as Array<{ id: string }>).map((p) => p.id)
      );
      const invalidIds = body.mirror_props.filter((id) => !validPropIds.has(id));

      if (invalidIds.length > 0) {
        return badRequest(
          `Invalid prop IDs in mirror_props: ${invalidIds.join(", ")}`
        );
      }

      mirrorProps = body.mirror_props;
      // Mirror mode: card_size is always the number of mirror props
      cardSize = mirrorProps.length;
    } else if (body.mirror_props && body.mirror_props.length > 0) {
      // mirror_props provided for non-mirror mode -- ignore it
      mirrorProps = null;
    }

    const challenge = await createChallenge(supabase, user.id, body.opponent_id, {
      gameMode,
      message,
      cardSize,
      mirrorProps,
    });

    // Fire-and-forget: notify opponent about the challenge
    try {
      const adminClient = createAdminClient();
      const { data: challengerProfile } = await (
        adminClient.from("profiles") as any
      )
        .select("username")
        .eq("id", user.id)
        .single();
      const challengerName =
        (challengerProfile as { username: string } | null)?.username ?? "Someone";

      // Build notification body with optional trash talk
      let notifBody = `You received a challenge from ${challengerName}!`;
      if (gameMode !== "classic") {
        const modeLabel = gameMode.replace("_", " ");
        notifBody = `${challengerName} challenged you to a ${modeLabel} match!`;
      }
      if (message) {
        notifBody += ` "${message}"`;
      }

      await createNotification(adminClient, {
        user_id: body.opponent_id,
        type: "challenge_received",
        title: "New Challenge",
        body: notifBody,
        metadata: {
          challenge_id: challenge.id,
          game_mode: gameMode,
        },
      });
    } catch (notifError) {
      console.error("Failed to create challenge_received notification:", notifError);
    }

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create challenge");
  }
}
