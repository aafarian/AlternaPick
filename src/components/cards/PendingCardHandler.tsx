"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { createCard } from "@/lib/cards/api";
import { toast } from "sonner";

/**
 * Runs at the root layout level. When a guest saves picks to sessionStorage
 * and then signs up / logs in, this creates the card and navigates to /picks.
 */
export default function PendingCardHandler() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    const pending = sessionStorage.getItem("pending_card_picks");
    if (!pending) return;

    sessionStorage.removeItem("pending_card_picks");
    let savedPicks, savedMode, cardSize;
    try {
      ({ picks: savedPicks, gameMode: savedMode, cardSize } = JSON.parse(pending));
    } catch {
      return;
    }

    (async () => {
      try {
        await createCard(savedPicks, undefined, null, savedMode, cardSize);
        toast.success("Card locked in!");
        router.push("/picks");
      } catch {
        toast.error("Failed to lock in your saved picks.");
      }
    })();
  }, [user, router]);

  return null;
}
