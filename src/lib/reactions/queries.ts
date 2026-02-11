import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  ReactionEmoji,
  ReactionTargetType,
  Reaction,
} from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";
import type { ReactionWithUser, ReactionCounts } from "./types";

/**
 * Fetch all reactions for a target (challenge or card) with user profile info.
 */
export async function getReactionsForTarget(
  supabase: SupabaseClient<Database>,
  targetType: ReactionTargetType,
  targetId: string
): Promise<ReactionWithUser[]> {
  const { data, error } = await typedFrom(supabase, "reactions")
    .select(
      "id, user_id, target_type, target_id, emoji, created_at, user:profiles!reactions_user_id_fkey(username, avatar_url)"
    )
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch reactions: ${error.message}`);
  }

  return (data ?? []) as ReactionWithUser[];
}

/**
 * Insert or update a reaction for a user on a target.
 * Uses upsert with the UNIQUE(user_id, target_type, target_id) constraint,
 * so calling this with a different emoji updates the existing reaction.
 */
export async function upsertReaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetType: ReactionTargetType,
  targetId: string,
  emoji: ReactionEmoji
): Promise<Reaction> {
  const { data, error } = await typedFrom(supabase, "reactions")
    .upsert(
      {
        user_id: userId,
        target_type: targetType,
        target_id: targetId,
        emoji,
      },
      { onConflict: "user_id,target_type,target_id" }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to upsert reaction: ${error?.message ?? "Unknown error"}`
    );
  }

  return data as Reaction;
}

/**
 * Delete a user's reaction on a target.
 */
export async function deleteReaction(
  supabase: SupabaseClient<Database>,
  userId: string,
  targetType: ReactionTargetType,
  targetId: string
): Promise<void> {
  const { error } = await typedFrom(supabase, "reactions")
    .delete()
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) {
    throw new Error(`Failed to delete reaction: ${error.message}`);
  }
}

/**
 * Get aggregated emoji counts for a target.
 * Returns a partial record — only emojis with >= 1 reaction are included.
 */
export async function getReactionCounts(
  supabase: SupabaseClient<Database>,
  targetType: ReactionTargetType,
  targetId: string
): Promise<ReactionCounts> {
  const { data, error } = await typedFrom(supabase, "reactions")
    .select("emoji")
    .eq("target_type", targetType)
    .eq("target_id", targetId);

  if (error) {
    throw new Error(`Failed to fetch reaction counts: ${error.message}`);
  }

  const counts: ReactionCounts = {};
  for (const row of (data ?? []) as Array<{ emoji: ReactionEmoji }>) {
    counts[row.emoji] = (counts[row.emoji] ?? 0) + 1;
  }

  return counts;
}
