/**
 * Hard-delete a user account.
 *
 * The schema is set up so that calling `auth.admin.deleteUser(userId)` triggers
 * a chain of FK actions that mostly produces the behavior we want:
 *
 *   auth.users(A) deleted
 *     → CASCADE: profiles(A) deleted
 *       → CASCADE: cards where user_id=A deleted (their own cards)
 *       → CASCADE: challenges where challenger_id=A deleted (1v1 + group)
 *       → CASCADE: challenges where opponent_id=A deleted (1v1)
 *       → CASCADE: friendships, leaderboard_entries, notifications,
 *         challenge_participants(A), user_achievements(A)
 *       → SET NULL: challenges.winner_id, profiles.referred_by
 *
 *     → SET NULL: cards.challenge_id for any card on a deleted challenge
 *       (the key bit for 1v1 — the OTHER party's locked card on a deleted
 *       1v1 challenge has its challenge_id cleared, becoming a solo card.
 *       The other party keeps their picks and their card resolves normally.)
 *
 * Migration 050 adds the missing ON DELETE actions that previously blocked
 * the cascade.
 *
 * The one case where raw cascade behavior is WRONG: group challenges where
 * the deleted user is the creator (challenger_id). The CASCADE on
 * `challenges.challenger_id` would wipe the whole group, taking every
 * participant's card with it. Group challenges should survive the loss of
 * one player — the group just goes from N → N-1.
 *
 * Pre-delete pass `transferGroupOwnership` handles this: for any active group
 * challenge where the user is the challenger AND there's at least one other
 * participant, transfer `challenges.challenger_id` to another participant
 * (preferring an existing creator-flagged participant, falling back to the
 * oldest one). The deleted user's own participant row then cascades away
 * without taking the group with it.
 */

import { logError, logInfo, logWarn } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface HardDeleteResult {
  success: boolean;
  error?: string;
}

interface CandidateParticipant {
  user_id: string | null;
  is_creator: boolean;
  created_at: string;
}

interface OwnedGroupChallenge {
  id: string;
}

/**
 * Before hard-deleting `userId`, transfer ownership of any active group
 * challenges they currently own to another participant. Without this, the
 * `challenges.challenger_id ON DELETE CASCADE` would wipe out the whole
 * group, including every other participant's card.
 *
 * If a group challenge has no other participants to transfer to, leave it
 * alone — CASCADE will delete the empty group, which is the correct behavior
 * for a one-person group.
 *
 * Best-effort: per-challenge errors are logged and skipped so one bad row
 * doesn't block the whole account delete (CLAUDE.md rule #3 — log + continue,
 * never silently swallow).
 */
export async function transferGroupOwnership(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<{ transferred: number }> {
  let transferred = 0;

  const { data: owned, error: ownedError } = await (admin.from("challenges") as any)
    .select("id")
    .eq("challenger_id", userId)
    .eq("lobby_type", "group")
    .in("status", ["draft", "pending", "accepted", "active"]);

  if (ownedError) {
    logError(
      "account-delete",
      `Failed to fetch owned group challenges for ${userId}`,
      "transferGroupOwnership",
      ownedError,
    );
    return { transferred };
  }

  for (const ch of (owned ?? []) as OwnedGroupChallenge[]) {
    try {
      // Find another participant to promote. Prefer existing creator-flagged
      // rows (in case the schema ever supports co-creators), then fall back
      // to the oldest joined participant.
      const { data: candidates } = await (admin.from("challenge_participants") as any)
        .select("user_id, is_creator, created_at")
        .eq("challenge_id", ch.id)
        .neq("user_id", userId)
        .not("user_id", "is", null)
        .order("is_creator", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1);

      const newOwner = (candidates as CandidateParticipant[] | null)?.[0];
      if (!newOwner?.user_id) {
        // No other participants — let the CASCADE delete this empty group.
        // (It's effectively a one-person group; nothing to preserve.)
        continue;
      }

      const { error: chUpdateError } = await (admin.from("challenges") as any)
        .update({ challenger_id: newOwner.user_id })
        .eq("id", ch.id);

      if (chUpdateError) {
        logError(
          "account-delete",
          `Failed to transfer challenger_id for challenge ${ch.id}`,
          "transferGroupOwnership",
          chUpdateError,
        );
        continue;
      }

      const { error: pUpdateError } = await (admin.from("challenge_participants") as any)
        .update({ is_creator: true })
        .eq("challenge_id", ch.id)
        .eq("user_id", newOwner.user_id);

      if (pUpdateError) {
        logWarn(
          "account-delete",
          `Failed to mark new creator on challenge_participants for ${ch.id}`,
          pUpdateError,
        );
        // Non-fatal — the challenger_id transfer is what matters.
      }

      transferred++;
    } catch (err) {
      logError(
        "account-delete",
        `Unexpected error transferring ownership for challenge ${ch.id}`,
        "transferGroupOwnership",
        err,
      );
    }
  }

  return { transferred };
}

export async function hardDeleteAccount(
  admin: SupabaseClient<Database>,
  userId: string,
): Promise<HardDeleteResult> {
  // Pre-delete pass: rescue group challenges from CASCADE-induced wipeout
  // by transferring ownership to a surviving participant.
  const { transferred } = await transferGroupOwnership(admin, userId);
  if (transferred > 0) {
    logInfo(
      "account-delete",
      `Transferred ownership of ${transferred} group challenge(s) before deleting user ${userId}`,
    );
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    logError(
      "account-delete",
      `Failed to hard-delete user ${userId}: ${error.message}`,
      "hardDeleteAccount",
      error,
    );
    return { success: false, error: error.message };
  }

  logInfo("account-delete", `Hard-deleted user ${userId}`);
  return { success: true };
}
