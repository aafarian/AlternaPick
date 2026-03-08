import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, NotificationPreferences } from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";
import { createNotification } from "@/lib/notifications/queries";
import { modeLabel } from "@/lib/modes/utils";
import { logError, logWarn } from "@/lib/logger";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getChallengeReceivedEmailProps } from "@/lib/email/templates/challenge-received";

/**
 * Notify the opponent about a new challenge via in-app notification + email.
 * Fire-and-forget — errors are logged but not thrown.
 */
export async function notifyChallengeOpponent(
  admin: SupabaseClient<Database>,
  opts: {
    challengeId: string;
    challengerId: string;
    opponentId: string;
    gameMode: GameMode;
    message: string | null;
  },
): Promise<void> {
  const { challengeId, challengerId, opponentId, gameMode, message } = opts;

  try {
    // Fetch challenger name
    const { data: challengerProfile, error: challengerProfileError } = await (
      admin.from("profiles") as any
    )
      .select("username")
      .eq("id", challengerId)
      .single();
    if (challengerProfileError) {
      logWarn("challenges", "Failed to fetch challenger profile for notification", challengerProfileError);
    }
    const challengerName =
      (challengerProfile as { username: string } | null)?.username ?? "Someone";

    let notifBody = `You received a challenge from ${challengerName}!`;
    if (gameMode !== "classic") {
      notifBody = `${challengerName} challenged you to a ${modeLabel(gameMode)} match!`;
    }
    if (message) {
      notifBody += ` "${message}"`;
    }

    // Fetch opponent profile (email + notification preferences)
    const { data: opponentProfile, error: opponentProfileError } = await (
      admin.from("profiles") as any
    )
      .select("username, email, notification_preferences")
      .eq("id", opponentId)
      .single();

    if (opponentProfileError) {
      logWarn("challenges", "Failed to fetch opponent profile for email", opponentProfileError);
    }

    const opponent = opponentProfile as {
      username: string;
      email: string | null;
      notification_preferences: NotificationPreferences | null;
    } | null;

    await createNotification(admin, {
      user_id: opponentId,
      type: "challenge_received",
      title: "New Challenge",
      body: notifBody,
      metadata: {
        challenge_id: challengeId,
        game_mode: gameMode,
      },
    }, opponent?.notification_preferences);

    // Send email to opponent if preferences allow
    if (!opponent) {
      logError("challenges", `Challenge email skipped: opponent profile null for ${opponentId}`);
    } else if (!opponent.email) {
      logWarn("challenges", `Challenge email skipped: no email on profile for ${opponentId}`);
    } else if (!shouldSendEmail("challenge_received", opponent.notification_preferences)) {
      logWarn("challenges", `Challenge email skipped: preferences disabled for ${opponentId}`);
    } else {
      const { subject, react, text } = getChallengeReceivedEmailProps({
        challengerUsername: challengerName,
        gameMode,
        message,
        challengeId,
      });
      void sendEmail({ to: opponent.email, subject, react, text });
    }
  } catch (notifError) {
    logError("challenges", "Failed to create challenge_received notification", undefined, notifError);
  }
}
