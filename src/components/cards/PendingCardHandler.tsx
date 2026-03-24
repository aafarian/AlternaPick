"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
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
  const pathname = usePathname();
  const processingRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (processingRef.current) return;

    const pending = sessionStorage.getItem("pending_card_picks");
    if (!pending) return;

    // Mark as processing to prevent duplicate calls (React strict mode, re-renders)
    processingRef.current = true;

    let savedPicks, savedMode, cardSize, challengeId;
    try {
      ({ picks: savedPicks, gameMode: savedMode, cardSize, challengeId } = JSON.parse(pending));
    } catch {
      sessionStorage.removeItem("pending_card_picks");
      processingRef.current = false;
      logWarn("pending-card", "Failed to parse pending_card_picks from sessionStorage");
      return;
    }

    (async () => {
      try {
        await createCard(savedPicks, undefined, challengeId ?? null, savedMode, cardSize);
        // Only clear after successful creation — keeps picks recoverable on failure
        sessionStorage.removeItem("pending_card_picks");
        toast.success("Card locked in!");
        const target = challengeId ? `/challenges/${challengeId}` : "/picks";
        if (pathname === target) {
          // Already on the target page — refresh server data instead of pushing
          router.refresh();
        } else {
          router.push(target);
        }
      } catch (err) {
        // Keep sessionStorage intact so a page refresh can retry
        processingRef.current = false;
        logWarn("pending-card", "Failed to create card from sessionStorage picks", err);
        toast.error("Failed to lock in your saved picks. Refresh to retry.");
      }
    })();
  }, [user, router, pathname]);

  return null;
}
