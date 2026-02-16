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
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

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

    const limit = limitParam ? parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? parseInt(offsetParam, 10) : undefined;

    const { challenges, hasMore } = await getChallenges(
      supabase,
      user.id,
      statusFilter,
      limit !== undefined ? { limit, offset } : undefined
    );

    // Also fetch which challenges the user has submitted cards for (avoids client waterfall)
    const challengeIds = challenges
      .filter((c) => ["pending", "accepted", "active"].includes(c.status))
      .map((c) => c.id);

    let userCardChallengeIds: string[] = [];
    if (challengeIds.length > 0) {
      const { data: userCards } = await (supabase.from("cards") as any)
        .select("challenge_id")
        .eq("user_id", user.id)
        .in("challenge_id", challengeIds);
      userCardChallengeIds = ((userCards ?? []) as Array<{ challenge_id: string }>).map(
        (c) => c.challenge_id
      );
    }

    return NextResponse.json({ challenges, userCardChallengeIds, hasMore });
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
        `Invalid game_mode: "${body.game_mode}". Must be one of: classic, sabotage, mirror, random, one_player, one_team`
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

    // ---- Validate mirror_props for mirror mode / auto-select for random ----
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
    } else if (gameMode === "random") {
      // Auto-select random props from upcoming games
      const LOCK_BUFFER_MS = 5 * 60 * 1000;
      const lockCutoff = new Date(Date.now() + LOCK_BUFFER_MS).toISOString();
      const tomorrowEnd = new Date();
      tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
      tomorrowEnd.setHours(23, 59, 59, 999);

      // Two-step query: get upcoming game IDs, then fetch their props
      const { data: upcomingGames, error: gamesError } = await typedFrom(supabase, "games")
        .select("id")
        .gte("commence_time", lockCutoff)
        .lte("commence_time", tomorrowEnd.toISOString());

      if (gamesError) {
        return badRequest("Failed to fetch upcoming games for random mode");
      }

      const gameIds = ((upcomingGames ?? []) as Array<{ id: string }>).map((g) => g.id);

      if (gameIds.length === 0) {
        return badRequest(
          `Not enough available props for random mode (need ${cardSize}, found 0)`
        );
      }

      const { data: availableProps, error: propsError } = await typedFrom(supabase, "props")
        .select("id")
        .in("game_id", gameIds);

      if (propsError) {
        return badRequest("Failed to fetch available props for random mode");
      }

      const propIds = ((availableProps ?? []) as Array<{ id: string }>).map((p) => p.id);

      if (propIds.length < cardSize) {
        return badRequest(
          `Not enough available props for random mode (need ${cardSize}, found ${propIds.length})`
        );
      }

      // Fisher-Yates shuffle and take cardSize
      for (let i = propIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [propIds[i], propIds[j]] = [propIds[j], propIds[i]];
      }
      mirrorProps = propIds.slice(0, cardSize);
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
