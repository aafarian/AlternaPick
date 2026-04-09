import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";
import { logError, logWarn } from "@/lib/logger";
import { sendEmail } from "@/lib/email/send";
import { getChallengeInviteEmailProps } from "@/lib/email/templates/challenge-invite";
import { createGuestToken } from "@/lib/challenges/guest-token";
import { typedFrom } from "@/lib/supabase/typed-queries";

/**
 * Send a challenge invite email to a non-user opponent.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function sendChallengeInviteEmail(
  admin: SupabaseClient<Database>,
  opts: {
    challengeId: string;
    challengerId: string;
    opponentEmail: string;
    gameMode: GameMode;
    message: string | null;
  },
): Promise<void> {
  const { challengeId, challengerId, opponentEmail, gameMode, message } = opts;

  try {
    // Fetch challenger name
    const { data: challengerProfile, error: challengerProfileError } = await typedFrom(admin, "profiles")
      .select("username")
      .eq("id", challengerId)
      .single();
    if (challengerProfileError) {
      logWarn("challenges", "Failed to fetch challenger profile for invite email", challengerProfileError);
    }
    const challengerName =
      (challengerProfile as { username: string } | null)?.username ?? "Someone";

    // Generate guest token and URL
    const { url: guestPickUrl } = await createGuestToken(challengeId, opponentEmail);

    const { subject, react, text } = getChallengeInviteEmailProps({
      challengerUsername: challengerName,
      gameMode,
      message,
      guestPickUrl,
    });

    // No bypass needed under blocklist semantics — non-users are not in the
    // blocklist by default, so the existing check passes through cleanly.
    sendEmail({ to: opponentEmail, subject, react, text }).catch((sendErr) => {
      logError("challenges", "Failed to deliver challenge invite email", "sendChallengeInviteEmail", sendErr);
    });
  } catch (err) {
    logError("challenges", "Failed to send challenge invite email", "sendChallengeInviteEmail", err);
  }
}
