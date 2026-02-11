/**
 * Shared formatting utilities.
 */

/**
 * Formats a timestamp as a human-readable relative time string.
 * @param compact - If true, omits "ago" / "yesterday" for tight UI spaces (e.g. "3m" vs "3m ago").
 */
export function formatTimeAgo(timestamp: string, compact = false): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";

  if (compact) {
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  }

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

/**
 * Formats an NBA game clock string (ISO 8601 duration) into a readable "Q1 5:30" format.
 * Handles halftime (Q2 0:00) and end-of-period (Qn 0:00) cases.
 */
export function formatClock(period: number, clock: string): string {
  const cleanClock = clock.replace(/^PT/, "").replace(/\.00S$/, "S");
  const match = cleanClock.match(/(\d+)M(\d+)/);
  const minutes = match ? parseInt(match[1], 10) : -1;
  const seconds = match ? parseInt(match[2], 10) : -1;
  const isZero = minutes === 0 && seconds === 0;

  // Halftime: end of Q2
  if (period === 2 && isZero) return "Half";

  // End of other periods
  if (isZero && period >= 1) return `End Q${period}`;

  const display = match ? `${match[1]}:${match[2].padStart(2, "0")}` : clock;
  return `Q${period} ${display}`;
}
