/** Challenge statuses that prevent new picks from being submitted. */
export const UNPICKABLE_CHALLENGE_STATUSES = ["cancelled", "declined", "resolved"] as const;

/**
 * Props whose games start within this window are considered "locked" and
 * cannot be picked. 5 minutes before game commence_time.
 */
export const LOCK_BUFFER_MS = 5 * 60 * 1000;

/** Maximum number of participants allowed in a group challenge lobby. */
export const MAX_LOBBY_SIZE = 8;

/** Minimum number of participants required to start a group challenge. */
export const MIN_LOBBY_SIZE = 2;
