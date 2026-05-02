import { createAdminClient } from "@/lib/supabase/admin";
import { formatPlacement } from "@/lib/challenges/display";
import { logError, logWarn } from "@/lib/logger";
import { createNotification } from "@/lib/notifications/queries";
import { checkAndUnlockAchievements } from "@/lib/achievements/engine";
import { sendEmail, shouldSendEmail } from "@/lib/email/send";
import { getChallengeResolvedEmailProps } from "@/lib/email/templates/challenge-resolved";
import type {
  Card,
  Challenge,
  NotificationPreferences,
} from "@/lib/supabase/types";
import {
  CHALLENGE_WIN_BONUS,
  CHALLENGE_TIE_BONUS,
  STARTING_BALANCE,
} from "@/lib/heatscore/constants";
import { DEFAULT_LEADERBOARD_STATS } from "@/lib/leaderboard/defaults";

export interface ChallengeResolutionResult {
  challenge_id: string;
  winner_id: string | null;
  challenger_score: number;
  opponent_score: number;
  is_tie: boolean;
}

/**
 * Build the "opponent" label used by group challenge result emails when
 * piggybacking on the 1v1 email template. A 2-person group has 1 "other
 * player"; anything bigger uses "{n} others".
 *
 * Pure helper, exported for unit testing.
 */
export function formatGroupOpponentLabel(totalParticipants: number): string {
  const otherCount = totalParticipants - 1;
  if (otherCount <= 1) return "1 other player";
  return `${otherCount} others`;
}

/** Participant data fetched from challenge_participants joined with their card. */
interface GroupParticipantCard {
  participant_id: string;
  user_id: string | null;
  card_id: string | null;
  card_score: number;
  card_heat_score: number;
  card_status: string;
}

/** Profile data for notification/email sending. */
type ProfileRow = {
  username: string;
  email?: string;
  notification_preferences?: NotificationPreferences | null;
} | null;

/**
 * Resolves all eligible challenges where linked cards have been resolved.
 * For 1v1 challenges: determines the winner by comparing card scores.
 * For group challenges: ranks all participants by score with dense ranking.
 * Updates the challenge row and (for 1v1 only) h2h_wins/h2h_losses in leaderboard_entries.
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
    // Branch: group challenges use participant-based resolution
    if (challenge.lobby_type === "group") {
      const groupResult = await resolveGroupChallenge(supabase, challenge);
      if (groupResult) {
        results.push(groupResult);
      }
      continue;
    }

    // --- 1v1 resolution (existing logic, unchanged) ---

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

    // Need exactly 2 cards and both must be resolved.
    // Email invite challenges where the opponent hasn't picked yet will have < 2 cards.
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
    const scoresTied = challengerScore === opponentScore;

    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (!scoresTied) {
      winnerId =
        challengerScore > opponentScore
          ? challenge.challenger_id
          : challenge.opponent_id;
      loserId =
        winnerId === challenge.challenger_id
          ? challenge.opponent_id
          : challenge.challenger_id;
    } else {
      // Tiebreaker: HeatScore (higher = better quality picks)
      const challengerHS = challengerCard.heat_score ?? 0;
      const opponentHS = opponentCard.heat_score ?? 0;
      if (challengerHS !== opponentHS) {
        winnerId =
          challengerHS > opponentHS
            ? challenge.challenger_id
            : challenge.opponent_id;
        loserId =
          winnerId === challenge.challenger_id
            ? challenge.opponent_id
            : challenge.challenger_id;
      }
      // If HeatScore also tied, winnerId stays null (true draw)
    }

    // For notifications: a "tie" means no winner was determined
    const isTie = winnerId === null;

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

    // Award challenge token bonus (winner gets CHALLENGE_WIN_BONUS, tie gets CHALLENGE_TIE_BONUS each)
    try {
      if (winnerId) {
        await awardChallengeTokens(supabase, winnerId, CHALLENGE_WIN_BONUS);
      } else {
        // True draw — both get tie bonus
        await awardChallengeTokens(supabase, challenge.challenger_id, CHALLENGE_TIE_BONUS);
        if (challenge.opponent_id) {
          await awardChallengeTokens(supabase, challenge.opponent_id, CHALLENGE_TIE_BONUS);
        }
      }
    } catch (tokenError) {
      logError("challenge-resolution", "Failed to award challenge tokens", undefined, tokenError);
    }

    // Fire-and-forget: notify both participants about challenge result
    try {
      const { data: challengerProfile, error: challengerProfileErr } = await (
        supabase.from("profiles") as any
      )
        .select("username, email, notification_preferences")
        .eq("id", challenge.challenger_id)
        .single();
      if (challengerProfileErr) {
        logWarn("challenge-resolution", "Failed to fetch challenger profile for email", challengerProfileErr);
      }
      let opponentProfile: ProfileRow = null;
      if (challenge.opponent_id) {
        const { data: oppData, error: opponentProfileErr } = await (
          supabase.from("profiles") as any
        )
          .select("username, email, notification_preferences")
          .eq("id", challenge.opponent_id)
          .single();
        if (opponentProfileErr) {
          logWarn("challenge-resolution", "Failed to fetch opponent profile for email", opponentProfileErr);
        }
        opponentProfile = oppData as ProfileRow;
      }
      const challengerName =
        (challengerProfile as ProfileRow)?.username ?? "Opponent";
      const opponentName = opponentProfile?.username ?? "Opponent";
      const challengerEmail = (challengerProfile as ProfileRow)?.email;
      const opponentEmail = opponentProfile?.email;
      const challengerPrefs =
        (challengerProfile as ProfileRow)?.notification_preferences ?? null;
      const opponentPrefs =
        opponentProfile?.notification_preferences ?? null;

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
      if (challenge.opponent_id) {
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
      }

      // Send challenge-resolved emails to both participants (fire-and-forget)
      try {
        // Transactional sends do NOT pass unsubscribeUrl — see friend route for rationale.
        if (
          challengerEmail &&
          shouldSendEmail("challenge_resolved", challengerPrefs)
        ) {
          const challengerEmailProps = getChallengeResolvedEmailProps({
            username: challengerName,
            myScore: challengerScore,
            theirScore: opponentScore,
            opponentName,
            isWinner: winnerId === challenge.challenger_id,
            isTie,
            challengeId: challenge.id,
          });
          void sendEmail({
            to: challengerEmail,
            subject: challengerEmailProps.subject,
            react: challengerEmailProps.react,
            text: challengerEmailProps.text,
          });
        }

        if (
          opponentEmail &&
          shouldSendEmail("challenge_resolved", opponentPrefs)
        ) {
          const opponentEmailProps = getChallengeResolvedEmailProps({
            username: opponentName,
            myScore: opponentScore,
            theirScore: challengerScore,
            opponentName: challengerName,
            isWinner: winnerId === challenge.opponent_id,
            isTie,
            challengeId: challenge.id,
          });
          void sendEmail({
            to: opponentEmail,
            subject: opponentEmailProps.subject,
            react: opponentEmailProps.react,
            text: opponentEmailProps.text,
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
    const participantIds = [challenge.challenger_id, challenge.opponent_id].filter(
      (id): id is string => id != null
    );
    for (const participantId of participantIds) {
      try {
        const lbResult = await (supabase.from("leaderboard_entries") as any)
          .select(
            "total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses"
          )
          .eq("user_id", participantId)
          .single();

        const lb = (lbResult.data ?? DEFAULT_LEADERBOARD_STATS) as {
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

/**
 * Resolve a group challenge. All active participants' cards must be resolved.
 * Ranks participants by score descending with dense ranking (ties get same placement).
 * Updates challenge_participants rows with placement/score, sets challenge to resolved.
 * Sends notifications and emails to all participants. Skips H2H stats.
 */
async function resolveGroupChallenge(
  supabase: ReturnType<typeof createAdminClient>,
  challenge: Challenge,
): Promise<ChallengeResolutionResult | null> {
  // Fetch active participants with their card_id
  const { data: participantRows, error: participantError } = await (
    supabase.from("challenge_participants") as any
  )
    .select("id, user_id, card_id, status")
    .eq("challenge_id", challenge.id)
    .eq("status", "active");

  if (participantError) {
    logError(
      "challenge-resolution",
      `Failed to fetch participants for group challenge ${challenge.id}: ${participantError.message}`,
    );
    return null;
  }

  const activeParticipants = (participantRows ?? []) as Array<{
    id: string;
    user_id: string | null;
    card_id: string | null;
    status: string;
  }>;

  // Need at least 2 active participants
  if (activeParticipants.length < 2) return null;

  // All active participants must have a card
  const participantsWithCards = activeParticipants.filter((p) => p.card_id != null);
  if (participantsWithCards.length !== activeParticipants.length) return null;

  // Fetch all cards for active participants
  const cardIds = participantsWithCards.map((p) => p.card_id as string);
  const { data: cardsData, error: cardsError } = await (supabase.from("cards") as any)
    .select("id, user_id, score, heat_score, status")
    .in("id", cardIds);

  if (cardsError) {
    logError(
      "challenge-resolution",
      `Failed to fetch cards for group challenge ${challenge.id}: ${cardsError.message}`,
    );
    return null;
  }

  const cards = (cardsData ?? []) as Array<{
    id: string;
    user_id: string | null;
    score: number;
    heat_score: number | null;
    status: string;
  }>;

  // All cards must be resolved
  if (!cards.every((c) => c.status === "resolved")) return null;

  // Build participant-card mapping
  const cardMap = new Map(cards.map((c) => [c.id, c]));
  const participantCards: GroupParticipantCard[] = [];

  for (const p of participantsWithCards) {
    const card = cardMap.get(p.card_id as string);
    if (!card) return null; // Card not found — skip resolution

    participantCards.push({
      participant_id: p.id,
      user_id: p.user_id,
      card_id: p.card_id,
      card_score: card.score,
      card_heat_score: card.heat_score ?? 0,
      card_status: card.status,
    });
  }

  // Sort by score descending, then HeatScore descending as tiebreaker
  participantCards.sort((a, b) => {
    if (b.card_score !== a.card_score) return b.card_score - a.card_score;
    return b.card_heat_score - a.card_heat_score;
  });

  // Assign placements with dense ranking (ties get same placement, next skips)
  const placements: Array<{ participant_id: string; user_id: string | null; placement: number; score: number }> = [];
  let currentPlacement = 1;

  for (let i = 0; i < participantCards.length; i++) {
    if (i > 0 && (participantCards[i].card_score < participantCards[i - 1].card_score || participantCards[i].card_heat_score < participantCards[i - 1].card_heat_score)) {
      currentPlacement = i + 1; // Standard competition ranking (1st, 1st, 3rd — not 1st, 1st, 2nd)
    }
    placements.push({
      participant_id: participantCards[i].participant_id,
      user_id: participantCards[i].user_id,
      placement: currentPlacement,
      score: participantCards[i].card_score,
    });
  }

  // Determine winner: participant(s) with placement 1
  const firstPlaceParticipants = placements.filter((p) => p.placement === 1);
  const hasFirstPlaceTie = firstPlaceParticipants.length > 1;
  // If there's a tie for 1st, winner_id is null; otherwise it's the sole 1st-place user
  const winnerId = hasFirstPlaceTie ? null : (firstPlaceParticipants[0]?.user_id ?? null);

  // Update each challenge_participants row with placement and score
  for (const p of placements) {
    const { error: updateErr } = await (supabase.from("challenge_participants") as any)
      .update({ placement: p.placement, score: p.score })
      .eq("id", p.participant_id);

    if (updateErr) {
      logError(
        "challenge-resolution",
        `Failed to update placement for participant ${p.participant_id} in challenge ${challenge.id}: ${updateErr.message}`,
      );
      // Continue updating other participants
    }
  }

  // Update challenge row: resolved with winner
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
      `Failed to update group challenge ${challenge.id}: ${updateResult.error.message}`,
    );
    return null;
  }

  // Award challenge token bonuses for group challenges.
  // Wrapped in try/catch so a token DB failure never blocks challenge resolution
  // (same guard as the 1v1 path).
  try {
    if (hasFirstPlaceTie) {
      for (const p of firstPlaceParticipants) {
        if (p.user_id) {
          await awardChallengeTokens(supabase, p.user_id, CHALLENGE_TIE_BONUS);
        }
      }
    } else if (winnerId) {
      await awardChallengeTokens(supabase, winnerId, CHALLENGE_WIN_BONUS);
    }
  } catch (tokenError) {
    logError("challenge-resolution", "Failed to award group challenge tokens", undefined, tokenError);
  }

  // Skip H2H stats for group challenges (only tracked for 1v1)

  const totalParticipants = placements.length;

  // Build the result using the top two scores for backward-compatible fields
  const topScore = placements[0]?.score ?? 0;
  const secondScore = placements.length > 1
    ? placements.find((p) => p.placement > 1)?.score ?? topScore
    : topScore;

  const challengeResult: ChallengeResolutionResult = {
    challenge_id: challenge.id,
    winner_id: winnerId,
    challenger_score: topScore,
    opponent_score: secondScore,
    is_tie: hasFirstPlaceTie,
  };

  // Fire-and-forget: notify all participants about their placement
  try {
    // Fetch profiles for all participants with user_ids
    const userIds = placements
      .map((p) => p.user_id)
      .filter((id): id is string => id != null);

    const profileMap = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await (
        supabase.from("profiles") as any
      )
        .select("id, username, email, notification_preferences")
        .in("id", userIds);

      if (profilesError) {
        logWarn("challenge-resolution", "Failed to fetch profiles for group notification", profilesError);
      }

      for (const prof of (profiles ?? []) as Array<{
        id: string;
        username: string;
        email?: string;
        notification_preferences?: NotificationPreferences | null;
      }>) {
        profileMap.set(prof.id, prof);
      }
    }

    for (const p of placements) {
      if (!p.user_id) continue; // Guest participants without user_id — skip notification

      const profile = profileMap.get(p.user_id);
      const prefs = profile?.notification_preferences ?? null;
      const msg = getGroupNotificationMessage(p.placement, totalParticipants, p.score);

      await createNotification(
        supabase,
        {
          user_id: p.user_id,
          type: "challenge_resolved",
          title: msg.title,
          body: msg.body,
          metadata: { challenge_id: challenge.id, placement: p.placement },
        },
        prefs
      );

      // Send email if the user has an email and hasn't opted out.
      // Transactional sends do NOT pass unsubscribeUrl — see friend route for rationale.
      try {
        const userEmail = profile?.email;
        if (userEmail && shouldSendEmail("challenge_resolved", prefs)) {
          const username = profile?.username ?? "Player";
          // Use the 1v1 email template with group-adapted data (placement as
          // score comparison). The opponent label is pluralized via the pure
          // helper above so it stays unit-testable.
          const emailProps = getChallengeResolvedEmailProps({
            username,
            myScore: p.score,
            theirScore: secondScore,
            opponentName: formatGroupOpponentLabel(totalParticipants),
            isWinner: p.placement === 1,
            isTie: hasFirstPlaceTie && p.placement === 1,
            challengeId: challenge.id,
          });
          void sendEmail({
            to: userEmail,
            subject: emailProps.subject,
            react: emailProps.react,
            text: emailProps.text,
          });
        }
      } catch (emailError) {
        logError(
          "challenge-resolution",
          `Failed to send group challenge_resolved email for user ${p.user_id}`,
          undefined,
          emailError
        );
      }
    }
  } catch (notifError) {
    logError(
      "challenge-resolution",
      "Failed to create group challenge_resolved notifications",
      undefined,
      notifError
    );
  }

  // Fire-and-forget: check achievements for all participants
  for (const p of placements) {
    if (!p.user_id) continue;

    try {
      const lbResult = await (supabase.from("leaderboard_entries") as any)
        .select(
          "total_cards, current_streak, best_streak, win_rate, h2h_wins, h2h_losses"
        )
        .eq("user_id", p.user_id)
        .single();

      const lb = (lbResult.data ?? DEFAULT_LEADERBOARD_STATS) as {
        total_cards: number;
        current_streak: number;
        best_streak: number;
        win_rate: number;
        h2h_wins: number;
        h2h_losses: number;
      };

      await checkAndUnlockAchievements(supabase, p.user_id, {
        challengeResolved: challengeResult,
        leaderboardStats: lb,
      });
    } catch (achievementError) {
      logError(
        "challenge-resolution",
        `Failed to check achievements for user ${p.user_id} after group challenge resolution`,
        undefined,
        achievementError
      );
    }
  }

  return challengeResult;
}

/**
 * Generate a notification message for a group challenge participant based on their placement.
 */
function getGroupNotificationMessage(
  placement: number,
  totalParticipants: number,
  score: number,
): { title: string; body: string } {
  if (placement === 1) {
    return {
      title: "You won!",
      body: `You placed 1st out of ${totalParticipants} with ${score} pts. Dominant.`,
    };
  }

  if (placement === 2) {
    return {
      title: "So Close!",
      body: `You placed 2nd out of ${totalParticipants} with ${score} pts. Almost had it.`,
    };
  }

  return {
    title: "Challenge Complete",
    body: `You placed ${formatPlacement(placement)} out of ${totalParticipants} with ${score} pts.`,
  };
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

/**
 * Award flat token bonus to a user for challenge participation.
 * Adds to both balance and lifetime. Creates leaderboard row if needed.
 */
async function awardChallengeTokens(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;

  // Try atomic credit via RPC first (prevents lost writes from concurrent ops)
  const { data: rpcResult, error: rpcError } = await (supabase.rpc as any)(
    "credit_fire_tokens",
    { p_user_id: userId, p_amount: amount, p_include_lifetime: true },
  );

  if (!rpcError && rpcResult !== -1) return; // success

  // Row doesn't exist — create it (new user's first challenge).
  // If a concurrent call just created the row, retry via RPC.
  const { error: insertErr } = await (supabase.from("leaderboard_entries") as any)
    .insert({
      user_id: userId,
      fire_tokens_balance: STARTING_BALANCE + amount,
      fire_tokens_lifetime: amount,
    });

  if (insertErr) {
    // Row was created concurrently — retry credit via RPC
    await (supabase.rpc as any)(
      "credit_fire_tokens",
      { p_user_id: userId, p_amount: amount, p_include_lifetime: true },
    );
  }
}
