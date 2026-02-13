import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Challenge,
  ChallengeStatus,
} from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ChallengeWithProfiles extends Challenge {
  challenger: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  opponent: { id: string; username: string; display_name: string | null; avatar_url: string | null };
}

export interface ChallengeDetail extends ChallengeWithProfiles {
  challenger_card: ChallengeCard | null;
  opponent_card: ChallengeCard | null;
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
    stat_category: string;
    line: number;
    game_id: string;
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
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
    )
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order("created_at", { ascending: false });

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
  const hasMore = limit !== undefined && results.length > limit;

  return {
    challenges: hasMore ? results.slice(0, limit) : results,
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
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
    )
    .eq("id", challengeId)
    .single();

  if (challengeError || !challenge) {
    return null;
  }

  const ch = challenge as ChallengeWithProfiles;

  // Verify user is a participant
  if (ch.challenger_id !== userId && ch.opponent_id !== userId) {
    return null;
  }

  // Fetch cards linked to this challenge
  // Must use admin client to bypass RLS — user can't see opponent's card
  const admin = createAdminClient();
  const { data: cards } = await (admin.from("cards") as any)
    .select(
      "id, user_id, status, score, total_picks, locked_at, resolved_at, picks(id, selection, result, actual_value, prop:props(id, player_name, player_id, stat_category, line, game_id))"
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
  const opponentCard =
    cardsList.find((c) => c.user_id === ch.opponent_id) ?? null;

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
}

/**
 * Create a new challenge. Validates friendship.
 * Accepts optional game mode, trash talk message, card size, and mirror props.
 */
export async function createChallenge(
  supabase: SupabaseClient<Database>,
  challengerId: string,
  opponentId: string,
  options: CreateChallengeOptions = {}
): Promise<Challenge> {
  const {
    gameMode = "classic",
    message = null,
    cardSize = 6,
    mirrorProps = null,
  } = options;

  if (challengerId === opponentId) {
    throw new ChallengeValidationError("Cannot challenge yourself");
  }

  // Check accepted friendship
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

  // Build the insert payload
  const insertPayload: Record<string, unknown> = {
    challenger_id: challengerId,
    opponent_id: opponentId,
    status: "pending",
    game_mode: gameMode,
    card_size: cardSize,
  };

  if (message) {
    insertPayload.message = message;
  }

  if (mirrorProps) {
    insertPayload.mirror_props = mirrorProps;
  }

  // Create the challenge
  const { data: challenge, error: createError } = await typedFrom(
    supabase,
    "challenges"
  )
    .insert(insertPayload)
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
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
 */
export async function respondToChallenge(
  supabase: SupabaseClient<Database>,
  challengeId: string,
  userId: string,
  action: ValidAction
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
    // Only the challenger can cancel, and only while pending
    if (ch.challenger_id !== userId) {
      throw new ChallengeValidationError(
        "Only the challenger can cancel",
        403
      );
    }
    if (ch.status !== "pending") {
      throw new ChallengeValidationError(
        "Can only cancel a pending challenge",
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

  const { data: updated, error: updateError } = await typedFrom(
    supabase,
    "challenges"
  )
    .update({ status: newStatus })
    .eq("id", challengeId)
    .select(
      "*, challenger:profiles!challenges_challenger_id_fkey(id, username, display_name, avatar_url), opponent:profiles!challenges_opponent_id_fkey(id, username, display_name, avatar_url)"
    )
    .single();

  if (updateError || !updated) {
    throw new Error(
      `Failed to update challenge: ${updateError?.message ?? "Unknown error"}`
    );
  }

  return updated as Challenge;
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
