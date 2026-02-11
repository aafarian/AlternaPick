import { describe, it, expect, vi, afterEach } from "vitest";
import { formatTimeAgo, formatClock } from "../format";

/* ---------- formatTimeAgo ---------- */

describe("formatTimeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function ago(ms: number): string {
    return new Date(Date.now() - ms).toISOString();
  }

  it('returns "just now" for timestamps less than a minute old', () => {
    expect(formatTimeAgo(ago(30_000))).toBe("just now");
  });

  it("returns minutes ago for < 60 min", () => {
    expect(formatTimeAgo(ago(5 * 60_000))).toBe("5m ago");
  });

  it("returns hours ago for < 24h", () => {
    expect(formatTimeAgo(ago(3 * 3_600_000))).toBe("3h ago");
  });

  it('returns "yesterday" for exactly 1 day', () => {
    expect(formatTimeAgo(ago(86_400_000))).toBe("yesterday");
  });

  it("returns Nd ago for multiple days", () => {
    expect(formatTimeAgo(ago(3 * 86_400_000))).toBe("3d ago");
  });

  // Compact mode
  it("compact: returns minutes without ago suffix", () => {
    expect(formatTimeAgo(ago(10 * 60_000), true)).toBe("10m");
  });

  it("compact: returns hours without ago suffix", () => {
    expect(formatTimeAgo(ago(7 * 3_600_000), true)).toBe("7h");
  });

  it("compact: returns days without yesterday", () => {
    expect(formatTimeAgo(ago(86_400_000), true)).toBe("1d");
  });
});

/* ---------- formatClock ---------- */

describe("formatClock", () => {
  it("formats a normal game clock", () => {
    expect(formatClock(1, "PT5M30.00S")).toBe("Q1 5:30");
  });

  it("preserves leading zeros from ISO duration minutes", () => {
    expect(formatClock(1, "PT05M30.00S")).toBe("Q1 05:30");
  });

  it("formats single-digit seconds with padding", () => {
    expect(formatClock(3, "PT2M5.00S")).toBe("Q3 2:05");
  });

  it('returns "Half" at end of Q2', () => {
    expect(formatClock(2, "PT00M00.00S")).toBe("Half");
  });

  it('returns "End Q1" at end of Q1', () => {
    expect(formatClock(1, "PT00M00.00S")).toBe("End Q1");
  });

  it('returns "End Q3" at end of Q3', () => {
    expect(formatClock(3, "PT00M00.00S")).toBe("End Q3");
  });

  it('returns "End Q4" at end of Q4', () => {
    expect(formatClock(4, "PT00M00.00S")).toBe("End Q4");
  });

  it("handles OT period", () => {
    expect(formatClock(5, "PT3M15.00S")).toBe("Q5 3:15");
  });

  it("falls back to raw clock if format is unrecognized", () => {
    expect(formatClock(1, "badformat")).toBe("Q1 badformat");
  });
});
