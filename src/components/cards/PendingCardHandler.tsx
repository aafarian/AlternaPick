"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { createCard } from "@/lib/cards/api";
import { logWarn } from "@/lib/logger";
import { toast } from "sonner";

// Module-level flag survives React strict mode unmount/remount cycles,
// unlike useRef which resets on each mount.
let processing = false;

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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (processing) return;

    const pending = sessionStorage.getItem("pending_card_picks");
    if (!pending) return;

    // Module-level flag prevents duplicate calls across strict mode remounts
    processing = true;

    let savedPicks, savedMode, cardSize, challengeId;
    try {
      ({ picks: savedPicks, gameMode: savedMode, cardSize, challengeId } = JSON.parse(pending));
    } catch {
      sessionStorage.removeItem("pending_card_picks");
      processing = false;
      logWarn("pending-card", "Failed to parse pending_card_picks from sessionStorage");
      return;
    }

    (async () => {
      try {
        await createCard(savedPicks, undefined, challengeId ?? null, savedMode, cardSize);
        sessionStorage.removeItem("pending_card_picks");
        if (mountedRef.current) toast.success("Card locked in!");
      } catch (err) {
        const message = err instanceof Error ? err.message : "";

        // 409: card already exists — treat as success (e.g. strict mode double-fire
        // or page refresh after the first call succeeded).
        if (message.includes("already have a card")) {
          sessionStorage.removeItem("pending_card_picks");
        } else {
          // Keep sessionStorage intact so a page refresh can retry
          processing = false;
          logWarn("pending-card", "Failed to create card from sessionStorage picks", err);
          if (mountedRef.current) toast.error("Failed to lock in your saved picks. Refresh to retry.");
          return;
        }
      }

      if (!mountedRef.current) return;
      const target = challengeId ? `/challenges/${challengeId}` : "/picks";
      if (pathname === target) {
        router.refresh();
      } else {
        router.push(target);
        // Also refresh after push so the target route fetches fresh server
        // data instead of serving a stale route-cache snapshot from before
        // the card was created.
        router.refresh();
      }
    })();
  }, [user, router, pathname]);

  return null;
}
