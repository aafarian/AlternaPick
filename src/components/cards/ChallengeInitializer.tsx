"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * Reads the `challenge` search param from the URL and, if present,
 * fetches challenge details from the API and sets challenge context
 * in the card builder. Renders nothing visible.
 */
export default function ChallengeInitializer() {
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge_id");
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
  }, [challengeId, setChallenge, state.challengeId, user?.id]);

  return null;
}
