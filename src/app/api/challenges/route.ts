import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { logError, logWarn } from "@/lib/logger";
import type { ChallengeStatus, NotificationPreferences } from "@/lib/supabase/types";
import { isValidGameMode } from "@/lib/modes/definitions";
import { modeLabel } from "@/lib/modes/utils";
import { MIN_CARD_SIZE, MAX_CARD_SIZE } from "@/lib/modes/types";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { getCachedProps } from "@/lib/odds-api/cache";
import {
  getChallenges,
  createChallenge,
} from "@/lib/challenges/queries";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getChallengeReceivedEmailProps } from "@/lib/email/templates/challenge-received";

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

    // Fetch card scores for resolved challenges (admin client bypasses RLS for opponent cards)
    const resolvedIds = challenges
      .filter((c) => c.status === "resolved")
      .map((c) => c.id);

    if (resolvedIds.length > 0) {
      const admin = createAdminClient();
      const { data: cards } = await (admin.from("cards") as any)
        .select("challenge_id, user_id, score")
        .in("challenge_id", resolvedIds);

      const scoreMap = new Map<string, { challengerScore: number; opponentScore: number }>();
      for (const card of (cards ?? []) as Array<{ challenge_id: string; user_id: string; score: number }>) {
        const ch = challenges.find((c) => c.id === card.challenge_id);
        if (!ch) continue;
        const entry = scoreMap.get(card.challenge_id) ?? { challengerScore: 0, opponentScore: 0 };
        if (card.user_id === ch.challenger_id) {
          entry.challengerScore = card.score;
        } else {
          entry.opponentScore = card.score;
        }
        scoreMap.set(card.challenge_id, entry);
      }

      for (const ch of challenges) {
        const scores = scoreMap.get(ch.id);
        if (scores) {
          ch.challenger_score = scores.challengerScore;
          ch.opponent_score = scores.opponentScore;
        }
      }
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
      // Use the same data source as the props page so random mode
      // sees the exact same props the user sees.
      const LOCK_BUFFER_MS = 5 * 60 * 1000;
      const now = Date.now();

      const allSportGames = await Promise.all([
        getCachedProps("nba").catch((err) => { logError("challenges", "Random mode: failed to fetch nba props", undefined, err); return null; }),
        getCachedProps("ncaab").catch((err) => { logError("challenges", "Random mode: failed to fetch ncaab props", undefined, err); return null; }),
        getCachedProps("epl").catch((err) => { logError("challenges", "Random mode: failed to fetch epl props", undefined, err); return null; }),
        getCachedProps("la_liga").catch((err) => { logError("challenges", "Random mode: failed to fetch la_liga props", undefined, err); return null; }),
      ]);

      const propIds = allSportGames
        .filter((games): games is NonNullable<typeof games> => games !== null)
        .flat()
        .filter((g) => new Date(g.commence_time).getTime() - now > LOCK_BUFFER_MS)
        .flatMap((g) => g.props.map((p) => p.id));

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
        notifBody = `${challengerName} challenged you to a ${modeLabel(gameMode)} match!`;
      }
      if (message) {
        notifBody += ` "${message}"`;
      }

      // Fetch opponent profile (email + notification preferences)
      const { data: opponentProfile, error: opponentProfileError } = await (
        adminClient.from("profiles") as any
      )
        .select("username, email, notification_preferences")
        .eq("id", body.opponent_id)
        .single();
      if (opponentProfileError) {
        logWarn("challenges", "Failed to fetch opponent profile for email", opponentProfileError);
      }

      const opponent = opponentProfile as {
        username: string;
        email: string | null;
        notification_preferences: NotificationPreferences | null;
      } | null;

      await createNotification(adminClient, {
        user_id: body.opponent_id,
        type: "challenge_received",
        title: "New Challenge",
        body: notifBody,
        metadata: {
          challenge_id: challenge.id,
          game_mode: gameMode,
        },
      }, opponent?.notification_preferences);

      // Send email to opponent if preferences allow
      if (
        opponent?.email &&
        shouldSendEmail("challenge_received", opponent.notification_preferences)
      ) {
        const { subject, react, text } = getChallengeReceivedEmailProps({
          challengerUsername: challengerName,
          gameMode,
          message,
          challengeId: challenge.id,
        });
        sendEmail({ to: opponent.email, subject, react, text }).catch((err) => logWarn("challenges", "Failed to send challenge_received email", err));
      }
    } catch (notifError) {
      logError("challenges", "Failed to create challenge_received notification", undefined, notifError);
    }

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create challenge");
  }
}
