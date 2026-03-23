"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { useAuth } from "@/lib/auth/auth-context";

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

          setChallenge(
            id,
            { username: info.challenger_name },
            info.game_mode ?? "classic",
            info.card_size ?? 6,
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

        // If the challenger already locked a card, the opponent must match
        // the challenger's actual pick count — not the challenge's configured
        // card_size (which may be a larger default like 6).
        const actualCardSize =
          challenge.challenger_card?.total_picks ??
          challenge.card_size ??
          6;

        setChallenge(
          id,
          { username: opponent.username },
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
