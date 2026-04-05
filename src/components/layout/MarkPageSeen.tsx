"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget component that marks a page as "seen" on mount.
 * Clears the unseen-data indicator dot in the nav bar.
 */
export function MarkPageSeen({ type }: { type: "analytics" | "wrapped" }) {
  useEffect(() => {
    fetch("/api/notifications/seen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => {
      // Best-effort — don't block the page if this fails
    });
  }, [type]);

  return null;
}
