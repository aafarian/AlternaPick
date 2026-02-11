import type { ReactionEmoji, ReactionTargetType } from "@/lib/supabase/types";

/**
 * A reaction row enriched with user profile info for display.
 */
export interface ReactionWithUser {
  id: string;
  user_id: string;
  target_type: ReactionTargetType;
  target_id: string;
  emoji: ReactionEmoji;
  created_at: string;
  user: {
    username: string;
    avatar_url: string | null;
  };
}

/**
 * Aggregated emoji counts for a target (challenge or card).
 * Only emojis with at least 1 reaction are present.
 */
export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;
