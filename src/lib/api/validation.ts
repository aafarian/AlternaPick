/**
 * Shared validation helpers for API route handlers.
 */

/** Matches a standard UUID v1-v5 (case-insensitive). */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
