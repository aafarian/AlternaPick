import { createAdminClient } from "@/lib/supabase/admin";
import { logError, logWarn } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getChallengeResolvedEmailProps } from "@/lib/email/templates/challenge-resolved";
import { tryGetUnsubscribeUrl } from "@/lib/email/unsubscribe-token";
import type {
  Card,
  Challenge,
  NotificationPreferences,
} from "@/lib/supabase/types";

export interface ChallengeResolutionResult {
  challenge_id: string;
  winner_id: string | null;
  challenger_score: number;
  opponent_score: number;
  is_tie: boolean;
}

/**
 * Resolves all eligible challenges where both linked cards have been resolved.
 * Determines the winner by comparing card scores, updates the challenge row,
 * and updates h2h_wins/h2h_losses in leaderboard_entries.
 */
export async function resolveEligibleChallenges(): Promise<
  ChallengeResolutionResult[]
> {
  const supabase = createAdminClient();

  // Fetch all active challenges
  const challengesResult = await (supabase.from("challenges") as any)
    .select("*")
    .eq("status", "active");

  if (challengesResult.error) {
    throw new Error(
      `Failed to fetch challenges: ${challengesResult.error.message}`
    );
  }

  const challenges = challengesResult.data as Challenge[];
  const results: ChallengeResolutionResult[] = [];

  for (const challenge of challenges) {
    // Fetch both cards linked to this challenge
    const cardsResult = await (supabase.from("cards") as any)
      .select("*")
      .eq("challenge_id", challenge.id);

    if (cardsResult.error) {
      logError(
        "challenge-resolution",
        `Failed to fetch cards for challenge ${challenge.id}: ${cardsResult.error.message}`
      );
      continue;
    }

    const cards = cardsResult.data as Card[];

    // Need exactly 2 cards and both must be resolved
    if (cards.length !== 2) continue;
    if (!cards.every((c) => c.status === "resolved")) continue;

    // Determine which card belongs to challenger vs opponent
    const challengerCard = cards.find(
      (c) => c.user_id === challenge.challenger_id
    );
    const opponentCard = cards.find(
      (c) => c.user_id === challenge.opponent_id
    );

    if (!challengerCard || !opponentCard) continue;

    const challengerScore = challengerCard.score;
    const opponentScore = opponentCard.score;
    const isTie = challengerScore === opponentScore;

    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (!isTie) {
      winnerId =
        challengerScore > opponentScore
          ? challenge.challenger_id
          : challenge.opponent_id;
      loserId =
        winnerId === challenge.challenger_id
          ? challenge.opponent_id
          : challenge.challenger_id;
    }

    // Update challenge row
    const updateResult = await (supabase.from("challenges") as any)
      .update({
        status: "resolved",
        winner_id: winnerId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", challenge.id);

    if (updateResult.error) {
      logError(
        "challenge-resolution",
        `Failed to update challenge ${challenge.id}: ${updateResult.error.message}`
      );
      continue;
    }

    // Update leaderboard H2H stats (only when there is a winner)
    if (winnerId && loserId) {
      await updateH2HStats(supabase, winnerId, loserId);
    }

    // Fire-and-forget: notify both participants about challenge result
    try {
      type ProfileRow = {
        username: string;
        email?: string;
        notification_preferences?: NotificationPreferences | null;
      } | null;

      const { data: challengerProfile, error: challengerProfileErr } = await (
        supabase.from("profiles") as any
      )
        .select("username, email, notification_preferences")
        .eq("id", challenge.challenger_id)
        .single();
      if (challengerProfileErr) {
        logWarn("challenge-resolution", "Failed to fetch challenger profile for email", challengerProfileErr);
      }
      const { data: opponentProfile, error: opponentProfileErr } = await (
        supabase.from("profiles") as any
      )
        .select("username, email, notification_preferences")
        .eq("id", challenge.opponent_id)
        .single();
      if (opponentProfileErr) {
        logWarn("challenge-resolution", "Failed to fetch opponent profile for email", opponentProfileErr);
      }
      const challengerName =
        (challengerProfile as ProfileRow)?.username ?? "Opponent";
      const opponentName =
        (opponentProfile as ProfileRow)?.username ?? "Opponent";
      const challengerEmail = (challengerProfile as ProfileRow)?.email;
      const opponentEmail = (opponentProfile as ProfileRow)?.email;
      const challengerPrefs =
        (challengerProfile as ProfileRow)?.notification_preferences ?? null;
      const opponentPrefs =
        (opponentProfile as ProfileRow)?.notification_preferences ?? null;

      const challengerMsg = getChallengeNotificationMessage(
        challengerScore,
        opponentScore,
        opponentName,
        winnerId === challenge.challenger_id
      );
      const opponentMsg = getChallengeNotificationMessage(
        opponentScore,
        challengerScore,
        challengerName,
        winnerId === challenge.opponent_id
      );

      await createNotification(
        supabase,
        {
          user_id: challenge.challenger_id,
          type: "challenge_resolved",
          title: challengerMsg.title,
          body: challengerMsg.body,
          metadata: { challenge_id: challenge.id },
        },
        challengerPrefs
      );
      await createNotification(
        supabase,
        {
          user_id: challenge.opponent_id,
          type: "challenge_resolved",
          title: opponentMsg.title,
          body: opponentMsg.body,
          metadata: { challenge_id: challenge.id },
        },
        opponentPrefs
      );

      // Send challenge-resolved emails to both participants (fire-and-forget)
      try {
        if (
          challengerEmail &&
          shouldSendEmail("challenge_resolved", challengerPrefs)
        ) {
          const challengerUnsubUrl = tryGetUnsubscribeUrl(challengerEmail);
          const challengerEmailProps = getChallengeResolvedEmailProps({
            username: challengerName,
            myScore: challengerScore,
            theirScore: opponentScore,
            opponentName,
            isWinner: winnerId === challenge.challenger_id,
            isTie,
            challengeId: challenge.id,
            unsubscribeUrl: challengerUnsubUrl,
          });
          void sendEmail({
            to: challengerEmail,
            subject: challengerEmailProps.subject,
            react: challengerEmailProps.react,
            text: challengerEmailProps.text,
            unsubscribeUrl: challengerUnsubUrl,
          });
        }

        if (
          opponentEmail &&
          shouldSendEmail("challenge_resolved", opponentPrefs)
        ) {
          const opponentUnsubUrl = tryGetUnsubscribeUrl(opponentEmail);
          const opponentEmailProps = getChallengeResolvedEmailProps({
            username: opponentName,
            myScore: opponentScore,
            theirScore: challengerScore,
            opponentName: challengerName,
            isWinner: winnerId === challenge.opponent_id,
            isTie,
            challengeId: challenge.id,
            unsubscribeUrl: opponentUnsubUrl,
          });
          void sendEmail({
            to: opponentEmail,
            subject: opponentEmailProps.subject,
            react: opponentEmailProps.react,
            text: opponentEmailProps.text,
            unsubscribeUrl: opponentUnsubUrl,
          });
        }
      } catch (emailError) {
        logError(
          "challenge-resolution",
          "Failed to send challenge_resolved emails",
          undefined,
          emailError
        );
      }
    } catch (notifError) {
      logError(
        "challenge-resolution",
        "Failed to create challenge_resolved notifications",
        undefined,
        notifError
      );
    }

    const challengeResult: ChallengeResolutionResult = {
      challenge_id: challenge.id,
      winner_id: winnerId,
      challenger_score: challengerScore,
      opponent_score: opponentScore,
      is_tie: isTie,
    };

    // Fire-and-forget: check achievements for both challenge participants
    for (const participantId of [
      challenge.challenger_id,
      challenge.opponent_id,
    ]) {
      try {
        const lbResult = await (supabase.from("leaderboard_entries") as any)
          .select(
            "total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses"
          )
          .eq("user_id", participantId)
          .single();

        const lb = (lbResult.data ?? {
          total_cards: 0,
          current_streak: 0,
          best_streak: 0,
          win_rate: 0,
          h2h_wins: 0,
          h2h_losses: 0,
        }) as {
          total_cards: number;
          current_streak: number;
          best_streak: number;
          win_rate: number;
          h2h_wins: number;
          h2h_losses: number;
        };

        await checkAndUnlockAchievements(supabase, participantId, {
          challengeResolved: challengeResult,
          leaderboardStats: lb,
        });
      } catch (achievementError) {
        logError(
          "challenge-resolution",
          `Failed to check achievements for user ${participantId} after challenge resolution`,
          undefined,
          achievementError
        );
      }
    }

    results.push(challengeResult);
  }

  return results;
}

function getChallengeNotificationMessage(
  myScore: number,
  theirScore: number,
  opponentName: string,
  isWinner: boolean
): { title: string; body: string } {
  const isTie = myScore === theirScore;
  const margin = Math.abs(myScore - theirScore);

  if (isTie) {
    return {
      title: "Dead Heat",
      body: `You and ${opponentName} tied ${myScore}-${theirScore}. Run it back?`,
    };
  }

  if (isWinner) {
    if (margin >= 3) {
      return {
        title: "Dominant Win!",
        body: `You destroyed ${opponentName} ${myScore}-${theirScore}. Not even close.`,
      };
    }
    if (margin === 1) {
      return {
        title: "Clutch Win!",
        body: `You edged out ${opponentName} ${myScore}-${theirScore}. That was tight.`,
      };
    }
    return {
      title: "Victory!",
      body: `You beat ${opponentName} ${myScore}-${theirScore}. Nice work.`,
    };
  }

  // Loss
  if (margin >= 3) {
    return {
      title: "Tough Loss",
      body: `${opponentName} got you ${theirScore}-${myScore}. Run it back?`,
    };
  }
  if (margin === 1) {
    return {
      title: "So Close!",
      body: `You fell just short against ${opponentName} ${myScore}-${theirScore}. Next time.`,
    };
  }
  return {
    title: "Better Luck Next Time",
    body: `${opponentName} took it ${theirScore}-${myScore}. Shake it off.`,
  };
}

/**
 * Updates h2h_wins for the winner and h2h_losses for the loser
 * in the leaderboard_entries table. Creates entries if they don't exist.
 */
async function updateH2HStats(
  supabase: ReturnType<typeof createAdminClient>,
  winnerId: string,
  loserId: string
): Promise<void> {
  // Update winner's h2h_wins
  const winnerEntry = await (supabase.from("leaderboard_entries") as any)
    .select("id, h2h_wins")
    .eq("user_id", winnerId)
    .single();

  if (winnerEntry.data) {
    await (supabase.from("leaderboard_entries") as any)
      .update({
        h2h_wins: (winnerEntry.data as { id: string; h2h_wins: number })
          .h2h_wins + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", winnerId);
  } else {
    // Create entry if it doesn't exist
    await (supabase.from("leaderboard_entries") as any).insert({
      user_id: winnerId,
      h2h_wins: 1,
      h2h_losses: 0,
      total_cards: 0,
      total_correct_picks: 0,
      win_rate: 0,
      current_streak: 0,
      best_streak: 0,
    });
  }

  // Update loser's h2h_losses
  const loserEntry = await (supabase.from("leaderboard_entries") as any)
    .select("id, h2h_losses")
    .eq("user_id", loserId)
    .single();

  if (loserEntry.data) {
    await (supabase.from("leaderboard_entries") as any)
      .update({
        h2h_losses: (loserEntry.data as { id: string; h2h_losses: number })
          .h2h_losses + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", loserId);
  } else {
    // Create entry if it doesn't exist
    await (supabase.from("leaderboard_entries") as any).insert({
      user_id: loserId,
      h2h_wins: 0,
      h2h_losses: 1,
      total_cards: 0,
      total_correct_picks: 0,
      win_rate: 0,
      current_streak: 0,
      best_streak: 0,
    });
  }
}
