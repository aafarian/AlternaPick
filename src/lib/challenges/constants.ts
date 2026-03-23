/** Challenge statuses that prevent new picks from being submitted. */
export const UNPICKABLE_CHALLENGE_STATUSES = ["cancelled", "declined", "resolved"] as const;

/**
 * Props whose games start within this window are considered "locked" and
 * cannot be picked. 5 minutes before game commence_time.
 */
export const LOCK_BUFFER_MS = 5 * 60 * 1000;
