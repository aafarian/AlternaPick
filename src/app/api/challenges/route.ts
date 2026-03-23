import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { logError } from "@/lib/logger";
import type { ChallengeStatus } from "@/lib/supabase/types";
import { isValidGameMode } from "@/lib/modes/definitions";
import { MIN_CARD_SIZE, MAX_CARD_SIZE } from "@/lib/modes/types";

import { isValidEmail } from "@/lib/validation";
import { LOCK_BUFFER_MS } from "@/lib/challenges/constants";
import { getCachedProps } from "@/lib/odds-api/cache";
import {
  getChallenges,
  createChallenge,
} from "@/lib/challenges/queries";
import { sendChallengeInviteEmail } from "@/lib/challenges/send-invite-email";

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
        "draft",
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

    // Fetch card scores for resolved challenges (admin client bypasses RLS for opponent cards).
    // Skip email invite challenges with no opponent_id — they can't have opponent scores.
    const resolvedIds = challenges
      .filter((c) => c.status === "resolved" && c.opponent_id)
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
  opponent_email?: string;
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

    if (!body.opponent_id && !body.opponent_email) {
      return badRequest("Either opponent_id or opponent_email is required");
    }

    // ---- Resolve opponent ----
    const opponentId: string | null = body.opponent_id ?? null;
    let opponentEmail: string | null = null;

    if (!body.opponent_id && body.opponent_email) {
      const email = body.opponent_email.trim().toLowerCase();

      if (!isValidEmail(email)) {
        return badRequest("Invalid email address");
      }

      // Always use the email invite flow — don't look up whether the email
      // belongs to an existing user. Identity is resolved when the recipient
      // clicks the invite link (logged-in users get claimed, others pick as
      // guests and convert on signup). This avoids leaking account existence.
      opponentEmail = email;
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
    const cardSize = body.card_size ?? 6;
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
    // Mirror mode: props will be selected on /props page after challenge creation
    // Challenge is created as "draft" and activated when challenger submits their card
    if (gameMode === "mirror") {
      mirrorProps = null;
    } else if (gameMode === "random") {
      // Use the same data source as the props page so random mode
      // sees the exact same props the user sees.
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

    const challenge = await createChallenge(supabase, user.id, opponentId, {
      gameMode,
      message,
      cardSize,
      mirrorProps,
      opponentEmail,
      status: "draft",
    });

    // Fire-and-forget: send invite email for email-based challenges
    if (opponentEmail) {
      const admin = createAdminClient();
      void sendChallengeInviteEmail(admin, {
        challengeId: challenge.id,
        challengerId: user.id,
        opponentEmail,
        gameMode,
        message,
      });
    }

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "Failed to create challenge");
  }
}
