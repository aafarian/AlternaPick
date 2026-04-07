import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Challenge,
  ChallengeStatus,
  ParticipantStatus,
} from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logInfo } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/queries";
import { MAX_LOBBY_SIZE, MIN_LOBBY_SIZE } from "@/lib/challenges/constants";

export interface ChallengeProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
}

/** Compact avatar data for group challenge list display. */
export interface ParticipantAvatar {
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
}

export interface ChallengeWithProfiles extends Challenge {
  challenger: ChallengeProfile;
  /**
   * Null when opponent_id is null (email invite challenge).
   * UI components that haven't been updated for email invites yet
   * can safely assert non-null for friend-based challenges.
   */
  opponent: ChallengeProfile | null;
  /** Populated for resolved challenges — challenger's card score */
  challenger_score?: number | null;
  /** Populated for resolved challenges — opponent's card score */
  opponent_score?: number | null;
  /** Populated for group challenges — total number of participants */
  participant_count?: number;
  /** Populated for resolved group challenges — current user's placement (1-based) */
  my_placement?: number | null;
  /** Populated for group challenges — current user's participant status */
  my_participant_status?: string | null;
  /** Populated for group challenges — compact avatar data for stacked display */
  participant_avatars?: ParticipantAvatar[];
  /** Populated for group challenges — participant display names for search matching */
  participant_names?: string[];
}

export interface ChallengeParticipantProfile {
  id: string;
  user_id: string | null;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
  email: string | null;
  status: ParticipantStatus;
  card_id: string | null;
  placement: number | null;
  score: number | null;
  is_creator: boolean;
  card: ChallengeCard | null;
}

export interface ChallengeDetail extends ChallengeWithProfiles {
  challenger_card: ChallengeCard | null;
  opponent_card: ChallengeCard | null;
  /** Populated for group challenges (lobby_type === 'group'). */
  participants?: ChallengeParticipantProfile[];
}

interface ChallengeCard {
  id: string;
  status: string;
  score: number;
  total_picks: number;
  locked_at: string | null;
  resolved_at: string | null;
  picks: ChallengePick[];
}

interface ChallengePick {
  id: string;
  selection: string;
  result: string;
  actual_value: number | null;
  prop: {
    id: string;
    player_name: string;
    player_id: string | null;
    player_team: string | null;
    player_position: string | null;
    stat_category: string;
    line: number;
    game_id: string;
    games?: { sport: string; commence_time: string };
  } | null;
}

type ValidAction = "accept" | "decline" | "cancel";

/**
 * Fetch challenges for a user, optionally filtered by status.
 */
export async function getChallenges(
  supabase: SupabaseClient<Database>,
  userId: string,
  statusFilter?: ChallengeStatus[],
  options?: { limit?: number; offset?: number }
): Promise<{ challenges: ChallengeWithProfiles[]; hasMore: boolean }> {
  const limit = options?.limit;
  const offset = options?.offset ?? 0;

  const admin = createAdminClient();

  // For group challenges, the user is a participant but not challenger/opponent.
  // RLS on the challenges table only allows challenger_id/opponent_id, so we
  // must fetch group challenges via admin client and merge them in.
  // Fetch group challenge IDs where this user is a participant.
  // Limit to a reasonable cap — users with extreme participation should paginate.
  const { data: participantRows } = await (admin.from("challenge_participants") as any)
    .select("challenge_id")
    .eq("user_id", userId)
    .limit(500);
  const groupChallengeIds = (participantRows ?? []).map(
    (r: { challenge_id: string }) => r.challenge_id
  );

  const selectFields =
    "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)";

  // Cap each query to avoid unbounded fetches. Since we merge + deduplicate,
  // each source may contribute up to the full page — fetch enough from each.
  const queryLimit = limit !== undefined ? offset + limit + 1 : undefined;

  // 1. Fetch 1v1 challenges via user client (RLS handles auth)
  let userQuery = typedFrom(supabase, "challenges")
    .select(selectFields)
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter.length > 0) {
    userQuery = userQuery.in("status", statusFilter);
  }
  if (queryLimit !== undefined) {
    userQuery = userQuery.limit(queryLimit);
  }

  // 2. Fetch group challenges via admin client (bypasses RLS)
  let groupQuery = groupChallengeIds.length > 0
    ? (admin.from("challenges") as any)
        .select(selectFields)
        .in("id", groupChallengeIds)
        .order("created_at", { ascending: false })
    : null;

  if (groupQuery && statusFilter && statusFilter.length > 0) {
    groupQuery = groupQuery.in("status", statusFilter);
  }
  if (groupQuery && queryLimit !== undefined) {
    groupQuery = groupQuery.limit(queryLimit);
  }

  const [userResult, groupResult] = await Promise.all([
    userQuery,
    groupQuery,
  ]);

  if (userResult.error) {
    throw new Error(`Failed to fetch challenges: ${userResult.error.message}`);
  }

  const userChallenges = (userResult.data ?? []) as ChallengeWithProfiles[];
  const groupChallenges = (groupResult?.data ?? []) as ChallengeWithProfiles[];

  // Merge and deduplicate (creator of a group challenge appears in both queries)
  const seenIds = new Set<string>();
  const merged: ChallengeWithProfiles[] = [];
  for (const c of [...userChallenges, ...groupChallenges]) {
    if (!seenIds.has(c.id)) {
      seenIds.add(c.id);
      merged.push(c);
    }
  }

  // Sort by created_at descending
  merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Apply pagination to the merged set (both queries fetched all matching rows,
  // so we paginate the combined result)
  const sliced = limit !== undefined ? merged.slice(offset, offset + limit + 1) : merged;
  const hasMore = limit !== undefined && sliced.length > limit;
  const paginated = hasMore ? sliced.slice(0, limit) : sliced;

  // Exclude draft challenges where the querying user is the opponent
  // (challenger should see their own drafts to continue prop selection)
  const filtered = paginated.filter(
    (c) => c.status !== "draft" || c.challenger_id === userId
  );

  return {
    challenges: filtered,
    hasMore,
  };
}

/**
 * Fetch a single challenge by ID with both players' cards, picks, and profiles.
 */
/**
 * Fetch full challenge detail. Returns null only if the challenge doesn't
 * exist — challenges are publicly viewable so non-participants (including
 * anonymous viewers passing `userId = null`) get the same data.
 *
 * The `userId` is still passed through for downstream personalization
 * (winner highlights, "your card" indicators) and for participant-only UI
 * controls in the React components, which gate writes themselves.
 */
export async function getChallenge(
  challengeId: string,
  _userId: string | null
): Promise<ChallengeDetail | null> {
  // Use admin client to fetch the challenge — RLS on the challenges table only
  // allows challenger_id/opponent_id, which excludes group participants and
  // anonymous viewers. Authorization for write actions is enforced elsewhere
  // (mutation routes / RLS on cards/picks).
  const admin = createAdminClient();

  const { data: challenge, error: challengeError } = await (admin.from("challenges") as any)
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return null;
  }

  const ch = challenge as ChallengeWithProfiles;
  const isGroup = ch.lobby_type === "group";

  // Note: when opponent_id is null (email invite), ch.opponent will be null
  // from the FK join. Downstream code must handle this.

  // Fetch cards linked to this challenge
  // Must use admin client to bypass RLS — user can't see opponent's card
  const { data: cards } = await (admin.from("cards") as any)
    .select(
      "id, user_id, status, score, total_picks, locked_at, resolved_at, picks(id, selection, result, actual_value, prop:props(id, player_name, player_id, player_team, player_position, stat_category, line, game_id, games(sport, commence_time)))"
    )
    .eq("challenge_id", challengeId);

  const cardsList = (cards ?? []) as Array<{
    id: string;
    user_id: string | null;
    status: string;
    score: number;
    total_picks: number;
    locked_at: string | null;
    resolved_at: string | null;
    picks: ChallengePick[];
  }>;

  const formatCard = (
    card: (typeof cardsList)[number] | null
  ): ChallengeCard | null => {
    if (!card) return null;
    return {
      id: card.id,
      status: card.status,
      score: card.score,
      total_picks: card.total_picks,
      locked_at: card.locked_at,
      resolved_at: card.resolved_at,
      picks: card.picks ?? [],
    };
  };

  // For group challenges, fetch participants with profiles and link cards
  if (isGroup) {
    const participants = await getParticipants(admin, challengeId);

    // Build a card lookup by user_id and card_id for linking
    const cardByUserId = new Map<string, (typeof cardsList)[number]>();
    const cardById = new Map<string, (typeof cardsList)[number]>();
    for (const c of cardsList) {
      if (c.user_id) cardByUserId.set(c.user_id, c);
      cardById.set(c.id, c);
    }

    const participantsWithCards: ChallengeParticipantProfile[] = participants.map((p) => {
      const card = p.card_id
        ? cardById.get(p.card_id) ?? null
        : p.user_id
          ? cardByUserId.get(p.user_id) ?? null
          : null;

      return {
        ...p,
        card: formatCard(card),
      };
    });

    return {
      ...ch,
      challenger_card: formatCard(cardsList.find((c) => c.user_id === ch.challenger_id) ?? null),
      opponent_card: null,
      participants: participantsWithCards,
    };
  }

  // 1v1 path: find challenger and opponent cards
  const challengerCard =
    cardsList.find((c) => c.user_id === ch.challenger_id) ?? null;
  // Find the opponent's card as "any card that isn't the challenger's".
  // This handles email invite challenges where both opponent_id and the guest
  // card's user_id may be null, and also survives partial conversion failures
  // where opponent_id was set but the card's user_id update failed.
  const opponentCard =
    cardsList.find((c) => c.user_id !== ch.challenger_id) ?? null;

  return {
    ...ch,
    challenger_card: formatCard(challengerCard),
    opponent_card: formatCard(opponentCard),
  };
}


/** Options for creating a challenge beyond the basic challenger/opponent IDs. */
export interface CreateChallengeOptions {
  gameMode?: GameMode;
  message?: string | null;
  cardSize?: number;
  mirrorProps?: string[] | null;
  opponentEmail?: string | null;
  status?: ChallengeStatus;
}

/**
 * Create a new challenge. Validates friendship when opponent is a known user.
 * When opponentId is null (email invite), skips friendship check and uses admin client.
 * Accepts optional game mode, trash talk message, card size, and mirror props.
 */
export async function createChallenge(
  supabase: SupabaseClient<Database>,
  challengerId: string,
  opponentId: string | null,
  options: CreateChallengeOptions = {}
): Promise<Challenge> {
  const {
    gameMode = "classic",
    message = null,
    cardSize = 6,
    mirrorProps = null,
    opponentEmail = null,
    status = "draft",
  } = options;

  if (opponentId && challengerId === opponentId) {
    throw new ChallengeValidationError("Cannot challenge yourself");
  }

  // Friend-based flow: validate friendship when opponent is a known user
  if (opponentId) {
    const { data: friendship, error: friendError } = await typedFrom(
      supabase,
      "friendships"
    )
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${challengerId},addressee_id.eq.${opponentId}),and(requester_id.eq.${opponentId},addressee_id.eq.${challengerId})`
      )
      .limit(1);

    if (friendError) {
      throw new Error(`Failed to check friendship: ${friendError.message}`);
    }

    if (!friendship || friendship.length === 0) {
      throw new ChallengeValidationError(
        "Opponent must be an accepted friend",
        403
      );
    }
  }

  // Build the insert payload
  const insertPayload: Record<string, unknown> = {
    challenger_id: challengerId,
    opponent_id: opponentId,
    status,
    game_mode: gameMode,
    card_size: cardSize,
  };

  if (message) {
    insertPayload.message = message;
  }

  if (mirrorProps) {
    insertPayload.mirror_props = mirrorProps;
  }

  if (opponentEmail) {
    insertPayload.opponent_email = opponentEmail;
  }

  // Use admin client when opponent_id is null (email invite) — RLS requires opponent_id for user-initiated inserts
  const client = opponentId ? supabase : createAdminClient();

  // Create the challenge
  const { data: challenge, error: createError } = await (client.from("challenges") as any)
    .insert(insertPayload)
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .single();

  if (createError || !challenge) {
    throw new Error(
      `Failed to create challenge: ${createError?.message ?? "Unknown error"}`
    );
  }

  return challenge as Challenge;
}

/**
 * Respond to a challenge: accept, decline, or cancel.
 * Cancel supports `draft`, `pending`, and `accepted` statuses.
 * When cancelling, optionally convert the challenger's card to solo.
 */
export async function respondToChallenge(
  supabase: SupabaseClient<Database>,
  challengeId: string,
  userId: string,
  action: ValidAction,
  convertToSolo?: boolean
): Promise<Challenge> {
  // Fetch current challenge
  const { data: challenge, error: fetchError } = await typedFrom(
    supabase,
    "challenges"
  )
    .select("*")
    .eq("id", challengeId)
    .single();

  if (fetchError || !challenge) {
    throw new ChallengeNotFoundError();
  }

  const ch = challenge as Challenge;

  // Email invite challenges cannot be accepted/declined through normal flow
  // (opponent responds by submitting picks via the guest pick page)
  if ((action === "accept" || action === "decline") && !ch.opponent_id) {
    throw new ChallengeValidationError(
      "Email invite challenges are accepted via the invite link",
      400
    );
  }

  // Validate permissions based on action
  if (action === "accept" || action === "decline") {
    // Only the opponent (challenged user) can accept or decline
    if (ch.opponent_id !== userId) {
      throw new ChallengeValidationError(
        "Only the challenged user can accept or decline",
        403
      );
    }
    if (ch.status !== "pending") {
      throw new ChallengeValidationError(
        `Cannot ${action} a challenge that is not pending (current: ${ch.status})`,
        400
      );
    }
  } else if (action === "cancel") {
    // Challenger can cancel while pending or accepted
    if (ch.challenger_id !== userId) {
      throw new ChallengeValidationError(
        "Only the challenger can cancel",
        403
      );
    }
    if (ch.status !== "draft" && ch.status !== "pending" && ch.status !== "accepted") {
      throw new ChallengeValidationError(
        "Can only cancel a draft, pending, or accepted challenge",
        400
      );
    }
  }

  const statusMap: Record<ValidAction, ChallengeStatus> = {
    accept: "accepted",
    decline: "declined",
    cancel: "cancelled",
  };

  const newStatus = statusMap[action];

  // Solo card conversion on cancel (detach challenger's card)
  if (action === "cancel" && convertToSolo && ch.game_mode !== "sabotage") {
    const admin = createAdminClient();
    await (admin.from("cards") as any)
      .update({ challenge_id: null })
      .eq("challenge_id", challengeId)
      .eq("user_id", ch.challenger_id);
  }

  const { data: updated, error: updateError } = await typedFrom(
    supabase,
    "challenges"
  )
    .update({ status: newStatus })
    .eq("id", challengeId)
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .single();

  if (updateError || !updated) {
    throw new Error(
      `Failed to update challenge: ${updateError?.message ?? "Unknown error"}`
    );
  }

  return updated as Challenge;
}

/**
 * Expire stale challenges. Called by cron (every 5 min).
 *
 * Three expiration triggers (apply to both 1v1 and group challenges):
 * 1. **Time-based**: draft/pending/accepted challenges older than 24h → cancelled
 * 2. **Card-resolved**: the challenger's card has fully resolved while the
 *    challenge is still waiting for the opponent — the opponent missed their window.
 * 3. **All props expired** (mirror/random only): every prop on the challenge has
 *    started — there's nothing left for the opponent to pick.
 *
 * A single game starting is NOT a trigger — the opponent can still pick the
 * remaining non-started props. Picks are hidden, so there's no information
 * leakage while games are live.
 *
 * In all cases, the challenger's card is detached and converted to solo
 * (unless sabotage mode, where card ownership is swapped).
 * For group challenges, all participants are also marked as declined.
 */
export async function expireStaleChallenges(
  admin: SupabaseClient<Database>
): Promise<{ expired: number; converted: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let expired = 0;
  let converted = 0;

  const processedIds = new Set<string>();

  // --- Trigger 1: Time-based (24h) ---
  const { data: stale } = await (admin.from("challenges") as any)
    .select("id, challenger_id, game_mode, lobby_type")
    .in("status", ["draft", "pending", "accepted"])
    .lt("created_at", cutoff);

  for (const ch of (stale ?? []) as StaleChallengeRow[]) {
    converted += await convertChallengerCardToSolo(admin, ch);
    if (ch.lobby_type === "group") {
      await declineAllGroupParticipants(admin, ch.id);
    }
    await cancelChallenge(admin, ch.id);
    expired++;
    processedIds.add(ch.id);
  }

  // --- Trigger 2: Challenger's card resolved ---
  // The challenger locked in picks, those games finished and were resolved by
  // resolveEligibleChallenges (which resolves solo cards for active challenges),
  // but the opponent still hasn't responded. Convert the challenger's card to
  // solo so they still get credit, then cancel the challenge.
  const { data: pending } = await (admin.from("challenges") as any)
    .select("id, challenger_id, game_mode, mirror_props, lobby_type")
    .in("status", ["draft", "pending", "accepted"]);

  const pendingChallenges = (pending ?? []) as Array<
    StaleChallengeRow & { mirror_props: string[] | null }
  >;

  for (const ch of pendingChallenges) {
    if (processedIds.has(ch.id)) continue;

    // Check if the challenger's card is resolved
    const { data: challengerCards } = await (admin.from("cards") as any)
      .select("id, status")
      .eq("challenge_id", ch.id)
      .eq("user_id", ch.challenger_id)
      .limit(1);

    const challengerCard = ((challengerCards ?? []) as Array<{ id: string; status: string }>)[0];
    if (!challengerCard || challengerCard.status !== "resolved") continue;

    // Challenger's card has resolved but opponent hasn't responded — expire
    converted += await convertChallengerCardToSolo(admin, ch);
    if (ch.lobby_type === "group") {
      await declineAllGroupParticipants(admin, ch.id);
    }
    await cancelChallenge(admin, ch.id);
    expired++;
    processedIds.add(ch.id);
  }

  // --- Trigger 3: All mirror_props expired (mirror/random only) ---
  // If every prop's game has started, the opponent has nothing left to pick.
  const now = new Date();

  for (const ch of pendingChallenges) {
    if (processedIds.has(ch.id)) continue;
    if (!ch.mirror_props || ch.mirror_props.length === 0) continue;

    const { data: propGames } = await (admin.from("props") as any)
      .select("id, games(commence_time)")
      .in("id", ch.mirror_props);

    const props = (propGames ?? []) as Array<{
      id: string;
      games: { commence_time: string } | null;
    }>;

    const allStarted = props.length > 0 && props.every(
      (p) => p.games && new Date(p.games.commence_time) <= now
    );

    if (!allStarted) continue;

    converted += await convertChallengerCardToSolo(admin, ch);
    if (ch.lobby_type === "group") {
      await declineAllGroupParticipants(admin, ch.id);
    }
    await cancelChallenge(admin, ch.id);
    expired++;
  }

  return { expired, converted };
}

/** Row shape used by expireStaleChallenges for both 1v1 and group queries. */
interface StaleChallengeRow {
  id: string;
  challenger_id: string;
  game_mode: string;
  lobby_type: string;
}

/**
 * Expire individual group challenge participants who haven't responded within 24h.
 * Called by cron (every 5 min), separately from expireStaleChallenges.
 *
 * For each active group challenge, finds participants still in "invited" status
 * whose created_at is older than 24h and marks them as "declined".
 * After marking declines, checks if the remaining non-declined participants
 * are below MIN_LOBBY_SIZE — if so, cancels the entire challenge and
 * converts the creator's card to solo.
 */
export async function expireStaleGroupParticipants(
  admin: SupabaseClient<Database>
): Promise<{ participantsDeclined: number; challengesCancelled: number }> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let participantsDeclined = 0;
  let challengesCancelled = 0;

  // Fetch group challenges that are still in a pre-resolved state
  const { data: groupChallenges } = await (admin.from("challenges") as any)
    .select("id, challenger_id, game_mode, lobby_type")
    .eq("lobby_type", "group")
    .in("status", ["draft", "pending", "accepted", "active"]);

  if (!groupChallenges || (groupChallenges as StaleChallengeRow[]).length === 0) {
    return { participantsDeclined, challengesCancelled };
  }

  for (const ch of groupChallenges as StaleChallengeRow[]) {
    // Find invited participants whose invite is older than 24h
    const { data: staleParticipants } = await (admin.from("challenge_participants") as any)
      .select("id")
      .eq("challenge_id", ch.id)
      .eq("status", "invited")
      .lt("created_at", cutoff);

    const staleRows = (staleParticipants ?? []) as Array<{ id: string }>;

    // Mark each stale participant as declined
    for (const p of staleRows) {
      const { error } = await (admin.from("challenge_participants") as any)
        .update({ status: "declined" })
        .eq("id", p.id)
        .eq("status", "invited"); // Guard: only update if still invited (idempotent)

      if (error) {
        logError("challenges", "Failed to decline stale group participant", "expireStaleGroupParticipants", error);
        continue;
      }
      participantsDeclined++;
    }

    // If we declined anyone, check if enough participants remain
    if (staleRows.length > 0) {
      const { data: remaining } = await (admin.from("challenge_participants") as any)
        .select("id")
        .eq("challenge_id", ch.id)
        .in("status", ["invited", "accepted", "active"]);

      const remainingCount = ((remaining ?? []) as Array<{ id: string }>).length;

      if (remainingCount < MIN_LOBBY_SIZE) {
        logInfo("challenges", `Group challenge ${ch.id} cancelled: only ${remainingCount} non-declined participants remain (min ${MIN_LOBBY_SIZE})`);
        await declineAllGroupParticipants(admin, ch.id);
        await convertChallengerCardToSolo(admin, ch);
        await cancelChallenge(admin, ch.id);
        challengesCancelled++;
      }
    }
  }

  return { participantsDeclined, challengesCancelled };
}

/**
 * Mark all non-declined participants as "declined" for a group challenge.
 * Used when the entire group challenge is being cancelled.
 */
async function declineAllGroupParticipants(
  admin: SupabaseClient<Database>,
  challengeId: string
): Promise<void> {
  const { error } = await (admin.from("challenge_participants") as any)
    .update({ status: "declined" })
    .eq("challenge_id", challengeId)
    .in("status", ["invited", "accepted", "active"]);

  if (error) {
    logError("challenges", "Failed to decline all group participants", "declineAllGroupParticipants", error);
  }
}

/** Detach the challenger's card from the challenge (convert to solo). Returns 1 if converted, 0 otherwise. */
async function convertChallengerCardToSolo(
  admin: SupabaseClient<Database>,
  ch: { id: string; challenger_id: string; game_mode: string },
): Promise<number> {
  // Sabotage cards are swapped — detaching them would assign the wrong card
  if (ch.game_mode === "sabotage") return 0;

  const { data: cards } = await (admin.from("cards") as any)
    .select("id")
    .eq("challenge_id", ch.id)
    .eq("user_id", ch.challenger_id);

  if (cards && (cards as { id: string }[]).length > 0) {
    await (admin.from("cards") as any)
      .update({ challenge_id: null })
      .eq("challenge_id", ch.id)
      .eq("user_id", ch.challenger_id);
    return 1;
  }
  return 0;
}

/** Cancel a challenge by setting its status to "cancelled". */
async function cancelChallenge(
  admin: SupabaseClient<Database>,
  challengeId: string,
): Promise<void> {
  await (admin.from("challenges") as any)
    .update({ status: "cancelled" })
    .eq("id", challengeId);
}

/**
 * Fetch participants for a group challenge, with profile data joined via user_id.
 * Guest participants (email-only, no user_id) will have null profile fields.
 */
export async function getParticipants(
  admin: SupabaseClient<Database>,
  challengeId: string
): Promise<ChallengeParticipantProfile[]> {
  const { data, error } = await (admin.from("challenge_participants") as any)
    .select(
      "id, user_id, card_id, status, placement, score, is_creator, email, profile:profiles!challenge_participants_user_id_fkey(username, display_name, avatar_url, icon_config)"
    )
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  if (error) {
    logError("challenges", "Failed to fetch participants", "getParticipants", error);
    return [];
  }

  return ((data ?? []) as Array<{
    id: string;
    user_id: string | null;
    card_id: string | null;
    status: ParticipantStatus;
    placement: number | null;
    score: number | null;
    is_creator: boolean;
    email: string | null;
    profile: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      icon_config: Record<string, unknown> | null;
    } | null;
  }>).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    username: p.profile?.username ?? null,
    display_name: p.profile?.display_name ?? null,
    avatar_url: p.profile?.avatar_url ?? null,
    icon_config: p.profile?.icon_config ?? null,
    email: p.email,
    status: p.status,
    card_id: p.card_id,
    placement: p.placement,
    score: p.score,
    is_creator: p.is_creator,
    card: null,
  }));
}

/**
 * Create a new challenge participant record.
 */
export async function createParticipant(
  admin: SupabaseClient<Database>,
  data: {
    challenge_id: string;
    user_id?: string | null;
    email?: string | null;
    status?: ParticipantStatus;
    is_creator?: boolean;
  }
): Promise<{ id: string } | null> {
  const { data: participant, error } = await (admin.from("challenge_participants") as any)
    .insert({
      challenge_id: data.challenge_id,
      user_id: data.user_id ?? null,
      email: data.email ?? null,
      status: data.status ?? "invited",
      is_creator: data.is_creator ?? false,
    })
    .select("id")
    .single();

  if (error) {
    logError("challenges", "Failed to create participant", "createParticipant", error);
    return null;
  }

  return participant as { id: string };
}

/**
 * Update a participant's status (e.g., invited → accepted).
 */
export async function updateParticipantStatus(
  admin: SupabaseClient<Database>,
  participantId: string,
  status: ParticipantStatus
): Promise<boolean> {
  const { error } = await (admin.from("challenge_participants") as any)
    .update({ status })
    .eq("id", participantId);

  if (error) {
    logError("challenges", "Failed to update participant status", "updateParticipantStatus", error);
    return false;
  }

  return true;
}

/** A single opponent entry in a group challenge request. Exactly one of user_id or email must be set. */
export interface GroupOpponent {
  user_id?: string;
  email?: string;
}

/** Options for creating a group challenge. */
export interface CreateGroupChallengeOptions {
  gameMode?: GameMode;
  message?: string | null;
  cardSize?: number;
  mirrorProps?: string[] | null;
  status?: ChallengeStatus;
}

/**
 * Create a group challenge with multiple opponents.
 * Validates opponents, creates the challenge row with lobby_type='group',
 * and creates challenge_participants rows for the creator and each opponent.
 *
 * For friend opponents (user_id set): validates accepted friendship.
 * For email opponents (email set): leaves user_id null on participant row.
 */
export async function createGroupChallenge(
  supabase: SupabaseClient<Database>,
  challengerId: string,
  challengerEmail: string | null,
  opponents: GroupOpponent[],
  options: CreateGroupChallengeOptions = {}
): Promise<Challenge> {
  const {
    gameMode = "classic",
    message = null,
    cardSize = 6,
    mirrorProps = null,
    status = "draft",
  } = options;

  // Max opponents is MAX_LOBBY_SIZE - 1 (the creator takes one slot)
  const maxOpponents = MAX_LOBBY_SIZE - 1;
  if (opponents.length > maxOpponents) {
    throw new ChallengeValidationError(
      `Too many opponents: max ${maxOpponents} (${MAX_LOBBY_SIZE} total including you)`
    );
  }

  // Validate each opponent has exactly one of user_id or email
  for (const opp of opponents) {
    if (opp.user_id && opp.email) {
      throw new ChallengeValidationError(
        "Each opponent must have either user_id or email, not both"
      );
    }
    if (!opp.user_id && !opp.email) {
      throw new ChallengeValidationError(
        "Each opponent must have either user_id or email"
      );
    }
  }

  // Check for self-challenge (by user_id or email)
  const normalizedCreatorEmail = challengerEmail?.toLowerCase() ?? null;
  for (const opp of opponents) {
    if (opp.user_id && opp.user_id === challengerId) {
      throw new ChallengeValidationError("Cannot challenge yourself");
    }
    if (opp.email && normalizedCreatorEmail && opp.email.toLowerCase() === normalizedCreatorEmail) {
      throw new ChallengeValidationError("Cannot challenge yourself");
    }
  }

  // Check for duplicate opponents
  const seenUserIds = new Set<string>();
  const seenEmails = new Set<string>();
  for (const opp of opponents) {
    if (opp.user_id) {
      if (seenUserIds.has(opp.user_id)) {
        throw new ChallengeValidationError("Duplicate opponent detected");
      }
      seenUserIds.add(opp.user_id);
    }
    if (opp.email) {
      const lower = opp.email.toLowerCase();
      if (seenEmails.has(lower)) {
        throw new ChallengeValidationError("Duplicate opponent email detected");
      }
      seenEmails.add(lower);
    }
  }

  // Validate friendships for user_id opponents
  const friendUserIds = opponents
    .filter((o): o is GroupOpponent & { user_id: string } => Boolean(o.user_id))
    .map((o) => o.user_id);

  if (friendUserIds.length > 0) {
    // Fetch all accepted friendships between challenger and these user IDs
    const orConditions = friendUserIds.map(
      (uid) => `and(requester_id.eq.${challengerId},addressee_id.eq.${uid}),and(requester_id.eq.${uid},addressee_id.eq.${challengerId})`
    ).join(",");

    const { data: friendships, error: friendError } = await typedFrom(
      supabase,
      "friendships"
    )
      .select("requester_id, addressee_id")
      .eq("status", "accepted")
      .or(orConditions);

    if (friendError) {
      throw new Error(`Failed to check friendships: ${friendError.message}`);
    }

    // Build a set of confirmed friend IDs
    const confirmedFriends = new Set<string>();
    for (const f of (friendships ?? []) as Array<{ requester_id: string; addressee_id: string }>) {
      if (f.requester_id === challengerId) {
        confirmedFriends.add(f.addressee_id);
      } else {
        confirmedFriends.add(f.requester_id);
      }
    }

    for (const uid of friendUserIds) {
      if (!confirmedFriends.has(uid)) {
        throw new ChallengeValidationError(
          "All user_id opponents must be accepted friends",
          403
        );
      }
    }
  }

  // Create the challenge row with lobby_type='group' using admin client (RLS bypass for group challenges)
  const admin = createAdminClient();
  const totalParticipants = opponents.length + 1;

  const insertPayload: Record<string, unknown> = {
    challenger_id: challengerId,
    opponent_id: null,
    status,
    game_mode: gameMode,
    card_size: cardSize,
    lobby_type: "group",
    max_participants: totalParticipants,
  };

  if (message) {
    insertPayload.message = message;
  }

  if (mirrorProps) {
    insertPayload.mirror_props = mirrorProps;
  }

  const { data: challenge, error: createError } = await (admin.from("challenges") as any)
    .insert(insertPayload)
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .single();

  if (createError || !challenge) {
    throw new Error(
      `Failed to create group challenge: ${createError?.message ?? "Unknown error"}`
    );
  }

  const createdChallenge = challenge as Challenge;

  // Create participant rows: creator first, then each opponent
  const creatorResult = await createParticipant(admin, {
    challenge_id: createdChallenge.id,
    user_id: challengerId,
    is_creator: true,
    status: "invited",
  });

  if (!creatorResult) {
    // Creator participant failed — clean up the challenge
    await (admin.from("challenges") as any)
      .update({ status: "cancelled" })
      .eq("id", createdChallenge.id);
    throw new Error("Failed to create creator participant for group challenge");
  }

  for (const opp of opponents) {
    const participantResult = await createParticipant(admin, {
      challenge_id: createdChallenge.id,
      user_id: opp.user_id ?? null,
      email: opp.email?.toLowerCase() ?? null,
      is_creator: false,
      status: "invited",
    });

    if (!participantResult) {
      logError(
        "challenges",
        "Failed to create opponent participant for group challenge",
        "createGroupChallenge",
        new Error(`participant creation failed for challenge ${createdChallenge.id}`)
      );
      // Continue creating other participants — partial failure is better than full failure
    }
  }

  return createdChallenge;
}

/**
 * Respond to a group challenge: accept, decline, or cancel.
 * Accept/decline updates the participant row (not the challenge status directly).
 * Cancel by the creator cancels the entire group challenge.
 */
export async function respondToGroupChallenge(
  admin: SupabaseClient<Database>,
  challengeId: string,
  userId: string,
  action: ValidAction,
  convertToSolo?: boolean
): Promise<Challenge> {
  // Fetch the challenge
  const { data: challenge, error: fetchError } = await (admin.from("challenges") as any)
    .select("*")
    .eq("id", challengeId)
    .single();

  if (fetchError || !challenge) {
    throw new ChallengeNotFoundError();
  }

  const ch = challenge as Challenge;

  if (ch.lobby_type !== "group") {
    throw new ChallengeValidationError("This function is only for group challenges");
  }

  // Find this user's participant row
  const { data: participantRows } = await (admin.from("challenge_participants") as any)
    .select("id, status, is_creator")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .limit(1);

  const participant = ((participantRows ?? []) as Array<{
    id: string;
    status: ParticipantStatus;
    is_creator: boolean;
  }>)[0];

  if (!participant) {
    throw new ChallengeValidationError("You are not a participant in this challenge", 403);
  }

  if (action === "cancel") {
    // Only the creator can cancel
    if (!participant.is_creator) {
      throw new ChallengeValidationError("Only the challenge creator can cancel", 403);
    }
    if (ch.status !== "draft" && ch.status !== "pending" && ch.status !== "accepted") {
      throw new ChallengeValidationError(
        "Can only cancel a draft, pending, or accepted challenge",
        400
      );
    }

    // Convert creator's card to solo if requested
    if (convertToSolo && ch.game_mode !== "sabotage") {
      await (admin.from("cards") as any)
        .update({ challenge_id: null })
        .eq("challenge_id", challengeId)
        .eq("user_id", ch.challenger_id);
    }

    // Mark all participants as declined
    await declineAllGroupParticipants(admin, challengeId);

    // Cancel the entire challenge
    const { data: updated, error: cancelError } = await (admin.from("challenges") as any)
      .update({ status: "cancelled" })
      .eq("id", challengeId)
      .select("*")
      .single();

    if (cancelError || !updated) {
      throw new Error(`Failed to cancel group challenge: ${cancelError?.message ?? "Unknown error"}`);
    }

    return updated as Challenge;
  }

  // Accept or decline — update participant status
  if (action === "accept" || action === "decline") {
    if (participant.is_creator) {
      throw new ChallengeValidationError("The creator cannot accept or decline their own challenge", 400);
    }

    if (participant.status !== "invited") {
      throw new ChallengeValidationError(
        `Cannot ${action} — participant status is already '${participant.status}'`,
        400
      );
    }

    if (ch.status !== "draft" && ch.status !== "pending") {
      throw new ChallengeValidationError(
        `Cannot ${action} a challenge that is not draft or pending (current: ${ch.status})`,
        400
      );
    }

    const newParticipantStatus: ParticipantStatus = action === "accept" ? "accepted" : "declined";
    const updated = await updateParticipantStatus(admin, participant.id, newParticipantStatus);

    if (!updated) {
      throw new Error(`Failed to update participant status to '${newParticipantStatus}'`);
    }

    // If declining, check if enough participants remain
    if (action === "decline") {
      await checkMinimumParticipants(admin, challengeId, ch);
    }
  }

  // Return the current challenge state
  const { data: currentChallenge, error: refetchError } = await (admin.from("challenges") as any)
    .select("*")
    .eq("id", challengeId)
    .single();

  if (refetchError || !currentChallenge) {
    throw new Error("Failed to refetch challenge after group response");
  }

  return currentChallenge as Challenge;
}

/**
 * Check if a group challenge still has enough non-declined participants.
 * If fewer than MIN_LOBBY_SIZE remain, cancel the challenge and convert creator's card to solo.
 */
async function checkMinimumParticipants(
  admin: SupabaseClient<Database>,
  challengeId: string,
  challenge: Challenge,
): Promise<void> {
  const { data: allParticipants } = await (admin.from("challenge_participants") as any)
    .select("id, status")
    .eq("challenge_id", challengeId);

  const remaining = ((allParticipants ?? []) as Array<{ id: string; status: string }>)
    .filter((p) => p.status !== "declined");

  if (remaining.length < MIN_LOBBY_SIZE) {
    // Not enough participants — cancel the challenge
    if (challenge.game_mode !== "sabotage") {
      await (admin.from("cards") as any)
        .update({ challenge_id: null })
        .eq("challenge_id", challengeId)
        .eq("user_id", challenge.challenger_id);
    }

    await declineAllGroupParticipants(admin, challengeId);
    await cancelChallenge(admin, challengeId);
  }
}

/**
 * Link a card to a participant row in a group challenge.
 * Sets card_id and status='active' on the participant row.
 * Then checks if all non-declined participants are active — if so, transitions challenge to 'active'.
 */
export async function linkCardToParticipant(
  admin: SupabaseClient<Database>,
  challengeId: string,
  userId: string,
  cardId: string
): Promise<void> {
  // Find the participant row for this user
  const { data: participantRows, error: findError } = await (admin.from("challenge_participants") as any)
    .select("id, status, is_creator")
    .eq("challenge_id", challengeId)
    .eq("user_id", userId)
    .limit(1);

  if (findError) {
    logError("challenges", "Failed to find participant for card linking", "linkCardToParticipant", findError);
    return;
  }

  const participant = ((participantRows ?? []) as Array<{ id: string; status: string; is_creator: boolean }>)[0];
  if (!participant) {
    logError("challenges", "No participant row found for card linking", "linkCardToParticipant", new Error(`No participant for user in challenge ${challengeId}`));
    return;
  }

  // Update participant: set card_id and status to 'active'
  const { error: updateError } = await (admin.from("challenge_participants") as any)
    .update({ card_id: cardId, status: "active" })
    .eq("id", participant.id);

  if (updateError) {
    logError("challenges", "Failed to link card to participant", "linkCardToParticipant", updateError);
    return;
  }

  // Non-creator locking in from "invited" implicitly accepts the challenge.
  // Notify the creator — this covers the direct pick-and-lock flow (detail
  // page / email invite redirect) where PATCH /accept is never called.
  // Skip if status is "accepted" — the PATCH /accept endpoint already sent
  // the notification when the user explicitly accepted.
  if (!participant.is_creator && participant.status === "invited") {
    try {
      const { data: challenge } = await (admin.from("challenges") as any)
        .select("challenger_id")
        .eq("id", challengeId)
        .single();

      if (challenge) {
        const { data: profile } = await (admin.from("profiles") as any)
          .select("username")
          .eq("id", userId)
          .single();

        const name = (profile as { username: string } | null)?.username ?? "Someone";
        await createNotification(admin, {
          user_id: (challenge as { challenger_id: string }).challenger_id,
          type: "challenge_accepted",
          title: "Challenge Accepted",
          body: `${name} accepted your group challenge!`,
          metadata: { challenge_id: challengeId },
        });
      }
    } catch (notifError) {
      logError("challenges", "Failed to notify challenger about group accept", "linkCardToParticipant", notifError);
    }
  }

  // When the creator locks in, promote the challenge from "draft" to "pending"
  // so it appears in opponents' inboxes and becomes eligible for early-start.
  if (participant.is_creator) {
    const { error: promoteError } = await (admin.from("challenges") as any)
      .update({ status: "pending" })
      .eq("id", challengeId)
      .eq("status", "draft");

    if (promoteError) {
      logError("challenges", "Failed to promote group challenge to pending", "linkCardToParticipant", promoteError);
    }
  }

  // Check if all non-declined participants are now active
  await checkGroupChallengeActivation(admin, challengeId);
}

/**
 * Check if all non-declined participants in a group challenge have status='active'.
 * If so, transition the challenge to 'active'.
 */
async function checkGroupChallengeActivation(
  admin: SupabaseClient<Database>,
  challengeId: string
): Promise<void> {
  const { data: allParticipants, error } = await (admin.from("challenge_participants") as any)
    .select("id, status")
    .eq("challenge_id", challengeId);

  if (error) {
    logError("challenges", "Failed to fetch participants for activation check", "checkGroupChallengeActivation", error);
    return;
  }

  const participants = (allParticipants ?? []) as Array<{ id: string; status: string }>;
  const nonDeclined = participants.filter((p) => p.status !== "declined");

  // All non-declined participants must be active, and we need at least MIN_LOBBY_SIZE
  if (nonDeclined.length >= MIN_LOBBY_SIZE && nonDeclined.every((p) => p.status === "active")) {
    const { error: activateError } = await (admin.from("challenges") as any)
      .update({ status: "active" })
      .eq("id", challengeId)
      .in("status", ["draft", "pending", "accepted"]);

    if (activateError) {
      logError("challenges", "Failed to activate group challenge", "checkGroupChallengeActivation", activateError);
    }
  }
}

/**
 * Link a card to a guest participant row in a group challenge (looked up by email).
 * Sets card_id and status='active' on the participant row.
 * Then checks if all non-declined participants are active — if so, transitions challenge to 'active'.
 */
export async function linkCardToGuestParticipant(
  admin: SupabaseClient<Database>,
  challengeId: string,
  email: string,
  cardId: string
): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  // Find the participant row by email
  const { data: participantRows, error: findError } = await (admin.from("challenge_participants") as any)
    .select("id, status")
    .eq("challenge_id", challengeId)
    .eq("email", normalizedEmail)
    .limit(1);

  if (findError) {
    logError("challenges", "Failed to find guest participant for card linking", "linkCardToGuestParticipant", findError);
    return;
  }

  const participant = ((participantRows ?? []) as Array<{ id: string; status: string }>)[0];
  if (!participant) {
    // Not a group challenge participant — this is normal for 1v1 email invites
    return;
  }

  // Update participant: set card_id and status to 'active'
  const { error: updateError } = await (admin.from("challenge_participants") as any)
    .update({ card_id: cardId, status: "active" })
    .eq("id", participant.id);

  if (updateError) {
    logError("challenges", "Failed to link card to guest participant", "linkCardToGuestParticipant", updateError);
    return;
  }

  // Check if all non-declined participants are now active
  await checkGroupChallengeActivation(admin, challengeId);
}

/**
 * Add a new participant to an existing group challenge.
 * Only allowed when the challenge is draft, pending, or accepted and
 * the lobby hasn't reached max capacity.
 */
export async function addParticipantToGroup(
  admin: SupabaseClient<Database>,
  challengeId: string,
  inviterId: string,
  newParticipant: { user_id?: string; email?: string },
): Promise<{ id: string }> {
  // Fetch the challenge
  const { data: challenge, error: fetchError } = await (admin.from("challenges") as any)
    .select("*")
    .eq("id", challengeId)
    .single();

  if (fetchError || !challenge) {
    throw new ChallengeNotFoundError();
  }

  const ch = challenge as Challenge;

  if (ch.status === "resolved" || ch.status === "cancelled") {
    throw new ChallengeValidationError(
      `Cannot add participants to a ${ch.status} challenge`
    );
  }

  // For 1v1 challenges, convert to group on first invite.
  // The inviter must be either the challenger or the opponent.
  const isH2H = ch.lobby_type !== "group";

  if (isH2H) {
    if (inviterId !== ch.challenger_id && inviterId !== ch.opponent_id) {
      throw new ChallengeValidationError("You are not a participant in this challenge", 403);
    }
  } else {
    // Group challenge — verify inviter is a non-declined participant
    const { data: inviterRows } = await (admin.from("challenge_participants") as any)
      .select("id, status")
      .eq("challenge_id", challengeId)
      .eq("user_id", inviterId)
      .limit(1);

    const inviter = ((inviterRows ?? []) as Array<{ id: string; status: string }>)[0];
    if (!inviter || inviter.status === "declined") {
      throw new ChallengeValidationError("You are not an active participant in this challenge", 403);
    }
  }

  // For H2H→group conversion, bootstrap participant rows first
  if (isH2H) {
    // Prevent inviting someone already in the challenge
    if (newParticipant.user_id === ch.challenger_id || newParticipant.user_id === ch.opponent_id) {
      throw new ChallengeValidationError("This user is already in the challenge");
    }
    if (newParticipant.user_id === inviterId) {
      throw new ChallengeValidationError("Cannot invite yourself");
    }

    // Find existing cards linked to this challenge
    const { data: existingCards } = await (admin.from("cards") as any)
      .select("id, user_id")
      .eq("challenge_id", challengeId)
      .limit(10);

    const cardsByUser = new Map<string, string>();
    for (const card of (existingCards ?? []) as Array<{ id: string; user_id: string }>) {
      cardsByUser.set(card.user_id, card.id);
    }

    // Convert to group: create participant rows for existing challenger + opponent
    const challengerCard = cardsByUser.get(ch.challenger_id) ?? null;
    const challengerParticipantStatus: ParticipantStatus = challengerCard ? "active" : "accepted";
    const challengerParticipant = await createParticipant(admin, {
      challenge_id: challengeId,
      user_id: ch.challenger_id,
      is_creator: true,
      status: challengerParticipantStatus,
    });
    // Link card to participant row
    if (challengerCard && challengerParticipant) {
      await (admin.from("challenge_participants") as any)
        .update({ card_id: challengerCard })
        .eq("id", challengerParticipant.id);
    }

    if (ch.opponent_id) {
      const opponentCard = cardsByUser.get(ch.opponent_id) ?? null;
      const opponentStatus: ParticipantStatus =
        opponentCard ? "active" :
        ch.status === "pending" ? "invited" :
        ch.status === "accepted" || ch.status === "active" ? "accepted" :
        "invited";

      const opponentParticipant = await createParticipant(admin, {
        challenge_id: challengeId,
        user_id: ch.opponent_id,
        is_creator: false,
        status: opponentStatus,
      });
      if (opponentCard && opponentParticipant) {
        await (admin.from("challenge_participants") as any)
          .update({ card_id: opponentCard })
          .eq("id", opponentParticipant.id);
      }
    }

    // Update challenge to group type
    await (admin.from("challenges") as any)
      .update({ lobby_type: "group", opponent_id: null })
      .eq("id", challengeId);
  }

  // Check lobby capacity (count non-declined participants)
  const { data: allParticipants } = await (admin.from("challenge_participants") as any)
    .select("id, status, user_id, email")
    .eq("challenge_id", challengeId);

  const active = ((allParticipants ?? []) as Array<{ id: string; status: string; user_id: string | null; email: string | null }>)
    .filter((p) => p.status !== "declined");

  if (active.length >= MAX_LOBBY_SIZE) {
    throw new ChallengeValidationError(
      `Lobby is full (max ${MAX_LOBBY_SIZE} participants)`
    );
  }

  // Prevent adding someone who is already active, or reactivate a declined participant
  if (!isH2H) {
    if (newParticipant.user_id) {
      if (newParticipant.user_id === inviterId) {
        throw new ChallengeValidationError("Cannot invite yourself");
      }
      const existing = active.find((p) => p.user_id === newParticipant.user_id);
      if (existing) {
        throw new ChallengeValidationError("This user is already in the challenge");
      }
    }
    if (newParticipant.email) {
      const normalizedEmail = newParticipant.email.toLowerCase();
      const existing = active.find((p) => p.email?.toLowerCase() === normalizedEmail);
      if (existing) {
        throw new ChallengeValidationError("This email is already in the challenge");
      }
    }
  }

  // Check if this user was previously kicked (declined row still exists).
  // If so, reactivate them instead of inserting a duplicate.
  const allRows = (allParticipants ?? []) as Array<{ id: string; status: string; user_id: string | null; email: string | null }>;
  const declinedRow = newParticipant.user_id
    ? allRows.find((p) => p.user_id === newParticipant.user_id && p.status === "declined")
    : newParticipant.email
      ? allRows.find((p) => p.email?.toLowerCase() === newParticipant.email!.toLowerCase() && p.status === "declined")
      : null;

  let result: { id: string } | null;

  if (declinedRow) {
    // Reactivate the existing declined row
    await (admin.from("challenge_participants") as any)
      .update({ status: "invited", card_id: null })
      .eq("id", declinedRow.id);
    result = { id: declinedRow.id };
  } else {
    // Create a new participant row
    result = await createParticipant(admin, {
      challenge_id: challengeId,
      user_id: newParticipant.user_id ?? null,
      email: newParticipant.email?.toLowerCase() ?? null,
      is_creator: false,
      status: "invited",
    });
  }

  if (!result) {
    throw new Error("Failed to add participant to challenge");
  }

  // Re-count after insert to guard against concurrent invites pushing past capacity.
  // If the lobby is now over the limit, roll back the insert.
  const { count: currentCount } = await (admin.from("challenge_participants") as any)
    .select("id", { count: "exact", head: true })
    .eq("challenge_id", challengeId)
    .neq("status", "declined");

  if (currentCount != null && currentCount > MAX_LOBBY_SIZE) {
    await (admin.from("challenge_participants") as any)
      .delete()
      .eq("id", result.id);
    throw new ChallengeValidationError(
      `Lobby is full (max ${MAX_LOBBY_SIZE} participants)`
    );
  }

  // Update max_participants to reflect the new count
  const newCount = currentCount ?? active.length + 1;
  await (admin.from("challenges") as any)
    .update({ max_participants: newCount })
    .eq("id", challengeId);

  return result;
}

/**
 * Remove a participant from a group challenge.
 * Only the creator can remove participants. Cannot remove yourself (use cancel instead).
 * Cannot remove participants who have live or started games on their card.
 * If removing drops below MIN_LOBBY_SIZE, the challenge is cancelled.
 */
export async function removeParticipantFromGroup(
  admin: SupabaseClient<Database>,
  challengeId: string,
  creatorId: string,
  targetUserId: string,
): Promise<void> {
  // Fetch the challenge
  const { data: challenge, error: fetchError } = await (admin.from("challenges") as any)
    .select("*")
    .eq("id", challengeId)
    .single();

  if (fetchError || !challenge) {
    throw new ChallengeNotFoundError();
  }

  const ch = challenge as Challenge;

  if (ch.lobby_type !== "group") {
    throw new ChallengeValidationError("Can only remove participants from group challenges");
  }

  if (ch.status === "resolved" || ch.status === "cancelled") {
    throw new ChallengeValidationError(
      `Cannot remove participants from a ${ch.status} challenge`
    );
  }

  // Verify the requester is the creator
  const { data: creatorRows } = await (admin.from("challenge_participants") as any)
    .select("id, is_creator")
    .eq("challenge_id", challengeId)
    .eq("user_id", creatorId)
    .limit(1);

  const creator = ((creatorRows ?? []) as Array<{ id: string; is_creator: boolean }>)[0];
  if (!creator?.is_creator) {
    throw new ChallengeValidationError("Only the challenge creator can remove participants", 403);
  }

  if (targetUserId === creatorId) {
    throw new ChallengeValidationError("Cannot remove yourself — use cancel instead");
  }

  // Find the target participant
  const { data: targetRows } = await (admin.from("challenge_participants") as any)
    .select("id, status, card_id")
    .eq("challenge_id", challengeId)
    .eq("user_id", targetUserId)
    .limit(1);

  const target = ((targetRows ?? []) as Array<{ id: string; status: string; card_id: string | null }>)[0];
  if (!target) {
    throw new ChallengeValidationError("Participant not found in this challenge");
  }

  if (target.status === "declined") {
    throw new ChallengeValidationError("This participant has already declined");
  }

  // Block removal if the participant has any picks with live/started games
  if (target.card_id) {
    const { data: picks } = await (admin.from("picks") as any)
      .select("id, games!inner(commence_time)")
      .eq("card_id", target.card_id)
      .limit(100);

    const now = new Date();
    const hasLiveGames = ((picks ?? []) as Array<{ id: string; games: { commence_time: string } }>)
      .some((p) => new Date(p.games.commence_time) <= now);

    if (hasLiveGames) {
      throw new ChallengeValidationError(
        "Cannot remove a participant who has games in progress"
      );
    }

    // No live games — detach the card
    await (admin.from("cards") as any)
      .update({ challenge_id: null })
      .eq("id", target.card_id);
  }

  // Mark participant as declined (soft delete — preserves history)
  await updateParticipantStatus(admin, target.id, "declined");

  // Update max_participants
  const { data: remaining } = await (admin.from("challenge_participants") as any)
    .select("id, status")
    .eq("challenge_id", challengeId);

  const nonDeclined = ((remaining ?? []) as Array<{ id: string; status: string }>)
    .filter((p) => p.status !== "declined");

  await (admin.from("challenges") as any)
    .update({ max_participants: nonDeclined.length })
    .eq("id", challengeId);

  // Check if enough participants remain
  if (nonDeclined.length < MIN_LOBBY_SIZE) {
    // Not enough participants — cancel the challenge
    if (ch.game_mode !== "sabotage") {
      await (admin.from("cards") as any)
        .update({ challenge_id: null })
        .eq("challenge_id", challengeId)
        .eq("user_id", ch.challenger_id);
    }
    await declineAllGroupParticipants(admin, challengeId);
    await cancelChallenge(admin, challengeId);
  }
}

export class ChallengeValidationError extends Error {
  public status: number;
  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "ChallengeValidationError";
    this.status = status;
  }
}

export class ChallengeNotFoundError extends Error {
  public status = 404;
  constructor() {
    super("Challenge not found");
    this.name = "ChallengeNotFoundError";
  }
}
