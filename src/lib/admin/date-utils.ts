/**
 * Timezone-aware date utilities for admin API routes.
 *
 * These helpers convert between UTC timestamps and the admin-facing
 * timezone (typically America/New_York) so that "today" in the dashboard
 * matches how an East Coast admin perceives the day boundary.
 */

const ADMIN_TIMEZONE = "America/New_York";

export { ADMIN_TIMEZONE };

/**
 * Returns the UTC ISO timestamp for the start of "today" (midnight) in the
 * given timezone. `dayOffset` shifts the date (e.g., -7 for 7 days ago).
 */
export function startOfDayInTimezone(
  now: Date,
  timeZone: string,
  dayOffset = 0,
): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const offsetPart = offsetFmt
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  let offsetMinutes = 0;
  if (offsetPart && offsetPart.startsWith("GMT")) {
    const sign = offsetPart[3] === "-" ? -1 : 1;
    const rest = offsetPart.slice(4);
    if (rest) {
      const [hh, mm] = rest.split(":").map(Number);
      offsetMinutes = sign * (hh * 60 + (mm ?? 0));
    }
  }

  const localMidnightAsUtc = Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0, 0);
  const utcInstant = localMidnightAsUtc - offsetMinutes * 60 * 1000;
  return new Date(utcInstant).toISOString();
}

/** Get the date string (YYYY-MM-DD) in the given timezone for an ISO timestamp. */
export function dateInTimezone(isoString: string, timeZone: string): string {
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return `${y}-${mo}-${dd}`;
}

/**
 * Get the hour (0-23) in the given timezone for an ISO timestamp.
 * Uses `hourCycle: "h23"` to guarantee 0-23 range (not 1-24).
 */
export function hourInTimezone(isoString: string, timeZone: string): number {
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  });
  return Number(fmt.format(d));
}
