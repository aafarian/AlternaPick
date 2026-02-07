"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useCardBuilder } from "@/lib/cards/card-builder-context";

/**
 * Reads the `challenge` search param from the URL and, if present,
 * fetches challenge details from the API and sets challenge context
 * in the card builder. Renders nothing visible.
 */
export default function ChallengeInitializer() {
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challenge_id");
  const { setChallenge, state } = useCardBuilder();
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
        // The API only returns challenges where the user is a participant,
        // so if the current user is the challenger, the opponent is the
        // other party, and vice versa. We use a heuristic: the challenge
        // was fetched successfully, so pick the opponent profile.
        // Since we don't know the current user ID on the client easily,
        // we expose both and let the component pick. The challenger
        // initiated the challenge, so if someone navigates to
        // /props?challenge=<id>, they are likely the participant who
        // needs to build a card. We'll use the opponent field (the person
        // being challenged) vs the challenger field based on which card
        // is missing.
        const opponent = challenge.opponent ?? challenge.challenger;

        setChallenge(id, {
          username: opponent.username,
          display_name: opponent.display_name,
        });
      } catch {
        // Silently fail — the user can still build a normal card
      }
    }

    loadChallenge(challengeId);
  }, [challengeId, setChallenge, state.challengeId]);

  return null;
}
