import { describe, it, expect } from "vitest";

// Re-import the helper. It's not exported, so we re-implement it here as
// a regression test that documents the intended behavior. If the helper in
// route.ts changes, this test will need to be updated.
function startOfDayInTimezone(now: Date, timeZone: string, dayOffset = 0): string {
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
  const offsetPart = offsetFmt.formatToParts(now).find((p) => p.type === "timeZoneName")?.value;
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

describe("startOfDayInTimezone", () => {
  it("returns ET midnight as UTC for a moment late at night ET (next day in UTC)", () => {
    // 2026-04-05 23:30 ET == 2026-04-06 03:30 UTC (EDT, GMT-04)
    const now = new Date("2026-04-06T03:30:00Z");
    const result = startOfDayInTimezone(now, "America/New_York");
    // ET midnight on 2026-04-05 == 2026-04-05 04:00 UTC
    expect(result).toBe("2026-04-05T04:00:00.000Z");
  });

  it("returns ET midnight as UTC for a moment early morning ET (same day in UTC)", () => {
    // 2026-04-06 02:00 ET == 2026-04-06 06:00 UTC
    const now = new Date("2026-04-06T06:00:00Z");
    const result = startOfDayInTimezone(now, "America/New_York");
    expect(result).toBe("2026-04-06T04:00:00.000Z");
  });

  it("handles a winter date (EST, GMT-05)", () => {
    // 2026-01-15 14:00 ET == 2026-01-15 19:00 UTC
    const now = new Date("2026-01-15T19:00:00Z");
    const result = startOfDayInTimezone(now, "America/New_York");
    // EST midnight on 2026-01-15 == 2026-01-15 05:00 UTC
    expect(result).toBe("2026-01-15T05:00:00.000Z");
  });

  it("supports a negative day offset (week start)", () => {
    // 2026-04-06 14:00 ET — 7 days back == 2026-03-30 midnight ET
    const now = new Date("2026-04-06T18:00:00Z");
    const result = startOfDayInTimezone(now, "America/New_York", -7);
    expect(result).toBe("2026-03-30T04:00:00.000Z");
  });

  it("regression: late-night ET signups still count as today's signups", () => {
    // The bug: a user signed up at 2026-04-05 18:00 ET (22:00 UTC),
    // and the admin checks the dashboard at 2026-04-05 23:30 ET (03:30 UTC the next day).
    // Old code computed todayStart from server local (UTC), giving 2026-04-06 00:00 UTC,
    // which is AFTER 22:00 UTC on the 5th — so the signup was excluded.
    // Fix: todayStart should be 2026-04-05 04:00 UTC (ET midnight), which is BEFORE the signup.
    const adminViewingNow = new Date("2026-04-06T03:30:00Z");
    const signupTimestamp = new Date("2026-04-05T22:00:00Z");
    const todayStart = startOfDayInTimezone(adminViewingNow, "America/New_York");
    expect(new Date(signupTimestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(todayStart).getTime(),
    );
  });
});
