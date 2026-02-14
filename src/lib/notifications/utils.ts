import type { Notification } from "@/lib/supabase/types";

/** Derive the in-app navigation path for a notification (or null if none). */
export function getNavigationPath(notification: Notification): string | null {
  const meta = notification.metadata as Record<string, unknown> | null;

  if (meta?.card_id) return "/picks";
  if (meta?.challenge_id) return `/challenges/${meta.challenge_id}`;
  if (
    notification.type === "friend_request" ||
    notification.type === "friend_accepted"
  )
    return "/friends";
  return null;
}
