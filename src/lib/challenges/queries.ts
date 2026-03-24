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
import { MAX_LOBBY_SIZE, MIN_LOBBY_SIZE } from "@/lib/challenges/constants";

export interface ChallengeProfile {
  id: string;
  username: string;
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
}

export interface ChallengeParticipantProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
  status: ParticipantStatus;
  placement: number | null;
  score: number | null;
  is_creator: boolean;
  email: string | null;
}

export interface ChallengeDetail extends ChallengeWithProfiles {
  challenger_card: ChallengeCard | null;
  opponent_card: ChallengeCard | null;
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
    games?: { sport: string };
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

  let query = typedFrom(supabase, "challenges")
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  // Note: email invite challenges (opponent_id is null) are included via the
  // challenger_id filter above. The FK join returns opponent: null for these.

  if (statusFilter && statusFilter.length > 0) {
    query = query.in("status", statusFilter);
  }

  if (limit !== undefined) {
    // Fetch one extra to check if there are more
    query = query.range(offset, offset + limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch challenges: ${error.message}`);
  }

  const results = (data ?? []) as ChallengeWithProfiles[];

  // Evaluate hasMore against the raw result set BEFORE filtering,
  // since draft filtering can silently remove the extra "+1" row.
  const hasMore = limit !== undefined && results.length > limit;
  const paginated = hasMore ? results.slice(0, limit) : results;

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
export async function getChallenge(
  supabase: SupabaseClient<Database>,
  challengeId: string,
  userId: string
): Promise<ChallengeDetail | null> {
  // Fetch the challenge with profiles
  const { data: challenge, error: challengeError } = await typedFrom(
    supabase,
    "challenges"
  )
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url, icon_config), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url, icon_config)"
    )
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return null;
  }

  const ch = challenge as ChallengeWithProfiles;

  // Verify user is a participant.
  // Email invite challenges have opponent_id = null — allow the challenger to view them.
  if (ch.challenger_id !== userId && ch.opponent_id !== userId) {
    return null;
  }

  // Note: when opponent_id is null (email invite), ch.opponent will be null
  // from the FK join. Downstream code must handle this.

  // Fetch cards linked to this challenge
  // Must use admin client to bypass RLS — user can't see opponent's card
  const admin = createAdminClient();
  const { data: cards } = await (admin.from("cards") as any)
    .select(
      "id, user_id, status, score, total_picks, locked_at, resolved_at, picks(id, selection, result, actual_value, prop:props(id, player_name, player_id, player_team, player_position, stat_category, line, game_id, games(sport)))"
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

  const challengerCard =
    cardsList.find((c) => c.user_id === ch.challenger_id) ?? null;
  // Find the opponent's card as "any card that isn't the challenger's".
  // This handles email invite challenges where both opponent_id and the guest
  // card's user_id may be null, and also survives partial conversion failures
  // where opponent_id was set but the card's user_id update failed.
  const opponentCard =
    cardsList.find((c) => c.user_id !== ch.challenger_id) ?? null;

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
        const convertResult = await convertChallengerCardToSolo(admin, ch);
        if (convertResult > 0) {
          // converted count tracked at caller level if needed
        }
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
      "id, status, placement, score, is_creator, email, user_id, profile:profiles!challenge_participants_user_id_fkey(username, display_name, avatar_url, icon_config)"
    )
    .eq("challenge_id", challengeId)
    .order("created_at", { ascending: true });

  if (error) {
    logError("challenges", "Failed to fetch participants", "getParticipants", error);
    return [];
  }

  return ((data ?? []) as Array<{
    id: string;
    status: ParticipantStatus;
    placement: number | null;
    score: number | null;
    is_creator: boolean;
    email: string | null;
    user_id: string | null;
    profile: {
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      icon_config: Record<string, unknown> | null;
    } | null;
  }>).map((p) => ({
    id: p.id,
    username: p.profile?.username ?? null,
    display_name: p.profile?.display_name ?? null,
    avatar_url: p.profile?.avatar_url ?? null,
    icon_config: p.profile?.icon_config ?? null,
    status: p.status,
    placement: p.placement,
    score: p.score,
    is_creator: p.is_creator,
    email: p.email,
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
