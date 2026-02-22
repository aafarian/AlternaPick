/**
 * Shared formatting utilities.
 */
import { usesHalves as sportUsesHalves } from "@/lib/sports";

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
    if (diffDays < 7) return `${diffDays}d`;
    return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a game clock string into a readable format (e.g. "Q1 5:30", "H1 5:30").
 * Supports both ISO 8601 durations (NBA: "PT05M30.00S") and display format (NCAAB/ESPN: "5:30").
 * Uses sport to determine period labels: H (halves) for ncaab/epl/la_liga, Q (quarters) for nba/nhl.
 */
export function formatClock(period: number, clock: string, sport?: string): string {
  // Parse ISO 8601 duration (e.g. "PT05M30.00S" → 5, 30)
  const cleanClock = clock.replace(/^PT/, "").replace(/\.00S$/, "S");
  const isoMatch = cleanClock.match(/(\d+)M(\d+)/);

  // Parse display format (e.g. "5:30", "0:00")
  const displayMatch = !isoMatch ? clock.match(/^(\d+):(\d{2})$/) : null;

  const match = isoMatch || displayMatch;
  const minutes = match ? parseInt(match[1], 10) : -1;
  const seconds = match ? parseInt(match[2], 10) : -1;
  const isZero = minutes === 0 && seconds === 0;

  // Determine if sport uses halves vs quarters
  const usesHalves = sport ? sportUsesHalves(sport) : false;
  const prefix = usesHalves ? "H" : "Q";
  // Halftime is end of H1 (period 1) for halves, end of Q2 (period 2) for quarters
  const halftimePeriod = usesHalves ? 1 : 2;

  if (period === halftimePeriod && isZero) return "Half";

  if (isZero && period >= 1) return `End ${prefix}${period}`;

  const display = match ? `${match[1]}:${match[2].padStart(2, "0")}` : clock;
  return `${prefix}${period} ${display}`;
}

/**
 * Formats an ISO 8601 commence_time into a short, human-readable game time.
 * Examples: "Today 7:00 PM", "Tomorrow 1:30 PM", "Feb 12 9:00 PM"
 */
export function formatGameTime(commenceTime: string): string {
  const gameDate = new Date(commenceTime);
  const now = new Date();

  const timeStr = gameDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  // Check if same calendar day
  const isToday =
    gameDate.getFullYear() === now.getFullYear() &&
    gameDate.getMonth() === now.getMonth() &&
    gameDate.getDate() === now.getDate();

  if (isToday) return `Today ${timeStr}`;

  // Check if tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    gameDate.getFullYear() === tomorrow.getFullYear() &&
    gameDate.getMonth() === tomorrow.getMonth() &&
    gameDate.getDate() === tomorrow.getDate();

  if (isTomorrow) return `Tomorrow ${timeStr}`;

  // Otherwise show short date
  const dateStr = gameDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return `${dateStr} ${timeStr}`;
}
