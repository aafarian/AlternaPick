import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";
import type { GroupOpponent } from "@/lib/challenges/queries";
import { notifyChallengeOpponent } from "@/lib/challenges/notify-opponent";
import { sendChallengeInviteEmail } from "@/lib/challenges/send-invite-email";
import { logError } from "@/lib/logger";

/**
 * Send invites to all participants in a group challenge.
 * Fire-and-forget — errors are logged per-participant but never thrown.
 *
 * - Friend participants (user_id set): in-app notification via `notifyChallengeOpponent`
 * - Email participants (email only): email invite via `sendChallengeInviteEmail` (creates guest token per call)
 */
export function notifyGroupChallengeParticipants(
  admin: SupabaseClient<Database>,
  opts: {
    challengeId: string;
    challengerId: string;
    opponents: GroupOpponent[];
    gameMode: GameMode;
    message: string | null;
  },
): void {
  const { challengeId, challengerId, opponents, gameMode, message } = opts;

  const invitePromises = opponents.map((opp) => {
    if (opp.user_id) {
      // Friend participant — send in-app notification + email
      return notifyChallengeOpponent(admin, {
        challengeId,
        challengerId,
        opponentId: opp.user_id,
        gameMode,
        message,
      }).catch((err) => {
        logError(
          "challenges",
          "Failed to notify group challenge participant",
          "notifyGroupChallengeParticipants",
          err,
        );
      });
    }

    // Email participant — send invite email (creates guest token internally)
    return sendChallengeInviteEmail(admin, {
      challengeId,
      challengerId,
      opponentEmail: opp.email!,
      gameMode,
      message,
    }).catch((err) => {
      logError(
        "challenges",
        "Failed to send group challenge invite email",
        "notifyGroupChallengeParticipants",
        err,
      );
    });
  });

  // Fire-and-forget: run all invites concurrently, don't block the response
  void Promise.all(invitePromises);
}
