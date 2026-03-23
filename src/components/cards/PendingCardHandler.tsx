"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { createCard } from "@/lib/cards/api";
import { logWarn } from "@/lib/logger";
import { toast } from "sonner";

/**
 * Runs at the root layout level. When a guest saves picks to sessionStorage
 * and then signs up / logs in, this creates the card and navigates to the
 * appropriate page.
 *
 * For email-invite challenges, the cards API auto-accepts the challenge
 * when the opponent creates their card.
 */
export default function PendingCardHandler() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem("pending_card_picks");
    if (!pending) return;

    sessionStorage.removeItem("pending_card_picks");
    let savedPicks, savedMode, cardSize, challengeId;
    try {
      ({ picks: savedPicks, gameMode: savedMode, cardSize, challengeId } = JSON.parse(pending));
    } catch {
      logWarn("pending-card", "Failed to parse pending_card_picks from sessionStorage");
      return;
    }

    (async () => {
      try {
        await createCard(savedPicks, undefined, challengeId ?? null, savedMode, cardSize);
        toast.success("Card locked in!");
        router.push(challengeId ? `/challenges/${challengeId}` : "/picks");
      } catch (err) {
        logWarn("pending-card", "Failed to create card from sessionStorage picks", err);
        toast.error("Failed to lock in your saved picks.");
      }
    })();
  }, [user, router]);

  return null;
}
