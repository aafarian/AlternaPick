"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { useAuth } from "@/lib/auth/auth-context";
import { getOpponentDisplayName } from "@/lib/challenges/display";

/**
 * Reads `challenge_id` (and optional `guest_token`) search params from the URL.
 *
 * - Authenticated users: fetches challenge details from the auth-gated API.
 * - Guests with a token: fetches challenge context from the guest-info endpoint
 *   and stores the token in card builder state for later use at lock-in.
 *
 * Renders nothing visible.
 */
export default function ChallengeInitializer() {
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge_id");
  const guestToken = searchParams.get("guest_token");
  const { setChallenge, state } = useCardBuilder();
  const { user } = useAuth();
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!challengeId) return;
    // Avoid re-fetching if we already loaded this challenge
    if (fetchedRef.current === challengeId) return;
    // Avoid re-fetching if already set in state
    if (state.challengeId === challengeId) return;

    fetchedRef.current = challengeId;

    async function loadChallenge(id: string) {
      try {
        // Guest flow: use the guest-info endpoint (token-authenticated, no login required)
        if (guestToken && !user) {
          const res = await fetch(
            `/api/challenges/${id}/guest-info?token=${encodeURIComponent(guestToken)}`
          );
          if (!res.ok) return;

          const data = await res.json();
          const info = data.challenge;
          if (!info) return;

          // Use the challenger's actual pick count when available, matching
          // the authenticated flow logic (lines 79-82 below).
          const actualCardSize =
            info.challenger_total_picks ??
            info.card_size ??
            6;

          setChallenge(
            id,
            { username: info.challenger_name },
            info.game_mode ?? "classic",
            actualCardSize,
            guestToken,
          );
          return;
        }

        // Authenticated flow: use the standard challenge API
        const res = await fetch(`/api/challenges/${id}`);
        if (!res.ok) return;

        const data = await res.json();
        const challenge = data.challenge;
        if (!challenge) return;

        // Determine who the opponent is relative to the current user.
        const isChallenger = user?.id === challenge.challenger_id;
        const opponent = isChallenger ? challenge.opponent : challenge.challenger;

        // For email invites, opponent profile is null — fall back to email display
        const opponentName = getOpponentDisplayName(
          opponent,
          isChallenger ? challenge.opponent_email : null,
        );

        // If the challenger already locked a card, the opponent must match
        // the challenger's actual pick count. If the challenger hasn't locked
        // in yet (draft challenge), don't constrain — let them pick 2-6 freely.
        const challengerPickCount = challenge.challenger_card?.total_picks ?? null;
        const actualCardSize = isChallenger && !challengerPickCount
          ? undefined  // Challenger picks freely; card_size set on lock-in (AP-015)
          : (challengerPickCount ?? challenge.card_size ?? 6);

        setChallenge(
          id,
          { username: opponentName },
          challenge.game_mode ?? "classic",
          actualCardSize,
        );
      } catch {
        // Silently fail — the user can still build a normal card
      }
    }

    loadChallenge(challengeId);
  }, [challengeId, guestToken, setChallenge, state.challengeId, user]);

  return null;
}
