import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import { logError } from "@/lib/logger";
import type { ChallengeStatus } from "@/lib/supabase/types";
import { isValidGameMode } from "@/lib/modes/definitions";
import { MIN_CARD_SIZE, MAX_CARD_SIZE } from "@/lib/modes/types";

import { isValidEmail } from "@/lib/validation";
import { LOCK_BUFFER_MS, MAX_LOBBY_SIZE } from "@/lib/challenges/constants";
import { getCachedProps } from "@/lib/odds-api/cache";
import {
  getChallenges,
  createChallenge,
  createGroupChallenge,
} from "@/lib/challenges/queries";
import type { GroupOpponent } from "@/lib/challenges/queries";
import { sendChallengeInviteEmail } from "@/lib/challenges/send-invite-email";
import { notifyGroupChallengeParticipants } from "@/lib/challenges/notify-group";

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
    // Include group challenges (opponent_id is null) — they have participant cards.
    const resolvedIds = challenges
      .filter((c) => c.status === "resolved" && (c.opponent_id || c.lobby_type === "group"))
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

    // Enrich group challenges with participant count, avatars, and placement
    const groupChallenges = challenges.filter((c) => c.lobby_type === "group");
    if (groupChallenges.length > 0) {
      const groupIds = groupChallenges.map((c) => c.id);
      const adminClient = createAdminClient();
      const { data: participants } = await (adminClient.from("challenge_participants") as any)
        .select(
          "challenge_id, user_id, placement, status, profile:profiles!challenge_participants_user_id_fkey(username, display_name, avatar_url, icon_config)"
        )
        .in("challenge_id", groupIds);

      type ParticipantRow = {
        challenge_id: string;
        user_id: string | null;
        placement: number | null;
        status: string;
        profile: {
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          icon_config: Record<string, unknown> | null;
        } | null;
      };

      const participantMap = new Map<string, ParticipantRow[]>();
      for (const p of (participants ?? []) as ParticipantRow[]) {
        const list = participantMap.get(p.challenge_id) ?? [];
        list.push(p);
        participantMap.set(p.challenge_id, list);
      }

      for (const ch of groupChallenges) {
        const parts = participantMap.get(ch.id) ?? [];
        ch.participant_count = parts.length;
        ch.participant_avatars = parts
          .filter((p) => p.status !== "declined")
          .map((p) => ({
            user_id: p.user_id,
            username: p.profile?.username ?? null,
            display_name: p.profile?.display_name ?? null,
            avatar_url: p.profile?.avatar_url ?? null,
            icon_config: p.profile?.icon_config ?? null,
          }));
        ch.participant_names = parts
          .filter((p) => p.status !== "declined")
          .map((p) => p.profile?.display_name || p.profile?.username || "")
          .filter(Boolean);

        // Set current user's participant data for group challenges
        const myParticipant = parts.find((p) => p.user_id === user.id);
        ch.my_placement = myParticipant?.placement ?? null;
        ch.my_participant_status = myParticipant?.status ?? null;
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
  opponents?: Array<{ user_id?: string; email?: string }>;
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

    // Determine whether this is a group challenge (opponents array with 2+ entries)
    const isGroupChallenge = Array.isArray(body.opponents) && body.opponents.length >= 2;

    // For single-opponent (1v1) flow, require opponent_id or opponent_email
    if (!isGroupChallenge && !body.opponent_id && !body.opponent_email) {
      return badRequest("Either opponent_id, opponent_email, or opponents array (2+) is required");
    }

    // ---- Shared validation: game_mode, message, card_size, mirror_props ----

    const gameMode = body.game_mode ?? "classic";
    if (!isValidGameMode(gameMode)) {
      return badRequest(
        `Invalid game_mode: "${body.game_mode}". Must be one of: classic, sabotage, mirror, random, one_player, one_team`
      );
    }

    const message = body.message ?? null;
    if (message !== null && message.length > 200) {
      return badRequest("Message must be 200 characters or fewer");
    }

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

    let mirrorProps: string[] | null = null;
    if (gameMode === "mirror") {
      mirrorProps = null;
    } else if (gameMode === "random") {
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

    // ---- Group challenge path ----
    if (isGroupChallenge) {
      const opponents = body.opponents as Array<{ user_id?: string; email?: string }>;

      // Validate opponent count against MAX_LOBBY_SIZE
      const maxOpponents = MAX_LOBBY_SIZE - 1;
      if (opponents.length > maxOpponents) {
        return badRequest(
          `Too many opponents: max ${maxOpponents} (${MAX_LOBBY_SIZE} total including you)`
        );
      }

      // Validate each opponent entry has exactly one identifier
      for (const opp of opponents) {
        if (opp.user_id && opp.email) {
          return badRequest("Each opponent must have either user_id or email, not both");
        }
        if (!opp.user_id && !opp.email) {
          return badRequest("Each opponent must have either user_id or email");
        }
        if (opp.email && !isValidEmail(opp.email.trim().toLowerCase())) {
          return badRequest("Invalid email address in opponents list");
        }
      }

      // Normalize opponents for the query layer
      const normalizedOpponents: GroupOpponent[] = opponents.map((o) => ({
        user_id: o.user_id,
        email: o.email?.trim().toLowerCase(),
      }));

      const challenge = await createGroupChallenge(
        supabase,
        user.id,
        user.email ?? null,
        normalizedOpponents,
        {
          gameMode,
          message,
          cardSize,
          mirrorProps,
          status: "draft",
        }
      );

      // Fire-and-forget: send invites to all group participants
      const admin = createAdminClient();
      notifyGroupChallengeParticipants(admin, {
        challengeId: challenge.id,
        challengerId: user.id,
        opponents: normalizedOpponents,
        gameMode,
        message,
      });

      return NextResponse.json({ challenge }, { status: 201 });
    }

    // ---- Single-opponent (1v1) path (unchanged) ----
    const opponentId: string | null = body.opponent_id ?? null;
    let opponentEmail: string | null = null;

    if (!body.opponent_id && body.opponent_email) {
      const email = body.opponent_email.trim().toLowerCase();

      if (!isValidEmail(email)) {
        return badRequest("Invalid email address");
      }

      // Prevent self-challenge via email
      if (user.email && email === user.email.toLowerCase()) {
        return badRequest("Cannot challenge yourself");
      }

      // Prevent spamming the same email with multiple open invites
      const adminCheck = createAdminClient();
      const { data: existingInvites } = (await (adminCheck.from("challenges") as any)
        .select("id")
        .eq("challenger_id", user.id)
        .eq("opponent_email", email)
        .not("status", "in", '("cancelled","declined","resolved")')
        .limit(1)) as { data: { id: string }[] | null; error: unknown };

      if ((existingInvites ?? []).length > 0) {
        return badRequest("You already have an open invite to this email address");
      }

      opponentEmail = email;
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
