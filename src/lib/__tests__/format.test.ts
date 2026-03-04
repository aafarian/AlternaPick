import { describe, it, expect, vi, afterEach } from "vitest";
import { formatTimeAgo, formatClock, formatGameTime } from "../format";

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
  /* ===== NBA (quarters, ISO clock format, no sport param) ===== */
  describe("NBA (quarters, ISO clock)", () => {
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

    it("formats full 12-minute clock at start of quarter", () => {
      expect(formatClock(1, "PT12M00.00S")).toBe("Q1 12:00");
    });

    it("formats mid-Q4 clock", () => {
      expect(formatClock(4, "PT07M22.00S")).toBe("Q4 07:22");
    });

    it("explicitly passing sport='nba' uses quarters", () => {
      expect(formatClock(1, "PT5M30.00S", "nba")).toBe("Q1 5:30");
      expect(formatClock(2, "PT00M00.00S", "nba")).toBe("Half");
    });
  });

  /* ===== NCAAB (halves, display clock format) ===== */
  describe("NCAAB (halves, display clock)", () => {
    it("formats H1 normal clock", () => {
      expect(formatClock(1, "15:00", "ncaab")).toBe("H1 15:00");
    });

    it("formats H2 normal clock", () => {
      expect(formatClock(2, "8:42", "ncaab")).toBe("H2 8:42");
    });

    it('returns "Half" at end of H1 (period=1, 0:00)', () => {
      expect(formatClock(1, "0:00", "ncaab")).toBe("Half");
    });

    it('returns "End H2" at end of H2 (period=2, 0:00)', () => {
      expect(formatClock(2, "0:00", "ncaab")).toBe("End H2");
    });

    it("formats overtime period (period=3)", () => {
      expect(formatClock(3, "5:00", "ncaab")).toBe("H3 5:00");
    });

    it("formats start of H1 (20:00)", () => {
      expect(formatClock(1, "20:00", "ncaab")).toBe("H1 20:00");
    });

    it("formats single-digit minutes", () => {
      expect(formatClock(2, "3:15", "ncaab")).toBe("H2 3:15");
    });
  });

  /* ===== EPL (halves, display clock format) ===== */
  describe("EPL (halves, display clock)", () => {
    it("formats H1 clock", () => {
      expect(formatClock(1, "25:00", "epl")).toBe("H1 25:00");
    });

    it("formats H2 clock", () => {
      expect(formatClock(2, "60:00", "epl")).toBe("H2 60:00");
    });

    it('returns "Half" at end of H1 (period=1, 0:00)', () => {
      expect(formatClock(1, "0:00", "epl")).toBe("Half");
    });

    it('returns "End H2" at end of H2 (period=2, 0:00)', () => {
      expect(formatClock(2, "0:00", "epl")).toBe("End H2");
    });

    it("formats stoppage time clock", () => {
      expect(formatClock(1, "45:00", "epl")).toBe("H1 45:00");
    });
  });

  /* ===== La Liga (halves, same behavior as EPL) ===== */
  describe("La Liga (halves, display clock)", () => {
    it("formats H1 clock", () => {
      expect(formatClock(1, "30:00", "la_liga")).toBe("H1 30:00");
    });

    it("formats H2 clock", () => {
      expect(formatClock(2, "75:00", "la_liga")).toBe("H2 75:00");
    });

    it('returns "Half" at end of H1', () => {
      expect(formatClock(1, "0:00", "la_liga")).toBe("Half");
    });

    it('returns "End H2" at end of H2', () => {
      expect(formatClock(2, "0:00", "la_liga")).toBe("End H2");
    });
  });

  /* ===== NHL (periods, uses quarters prefix) ===== */
  describe("NHL (periods, Q prefix)", () => {
    it("uses Q prefix (not halves)", () => {
      expect(formatClock(1, "15:00", "nhl")).toBe("Q1 15:00");
    });

    it('returns "Half" at end of Q2', () => {
      expect(formatClock(2, "0:00", "nhl")).toBe("Half");
    });

    it('returns "End Q1" at end of period 1', () => {
      expect(formatClock(1, "0:00", "nhl")).toBe("End Q1");
    });

    it('returns "End Q3" at end of period 3', () => {
      expect(formatClock(3, "0:00", "nhl")).toBe("End Q3");
    });
  });

  /* ===== Edge cases ===== */
  describe("edge cases", () => {
    it("falls back to raw clock if format is unrecognized", () => {
      expect(formatClock(1, "badformat")).toBe("Q1 badformat");
    });

    it("falls back to raw clock for unrecognized format with halves sport", () => {
      expect(formatClock(1, "badformat", "ncaab")).toBe("H1 badformat");
    });

    it("no sport parameter defaults to quarters (backward compat)", () => {
      expect(formatClock(1, "5:30")).toBe("Q1 5:30");
      expect(formatClock(2, "0:00")).toBe("Half");
    });

    it("unknown sport defaults to quarters (not halves)", () => {
      expect(formatClock(1, "5:30", "unknown_sport")).toBe("Q1 5:30");
    });

    it("period=0 pre-game with zero clock", () => {
      // period=0 with 0:00 — isZero is true but period >= 1 check fails for End,
      // and halftimePeriod check fails, so it should show the display format
      expect(formatClock(0, "0:00")).toBe("Q0 0:00");
    });

    it("ISO format with no leading zero in minutes", () => {
      expect(formatClock(2, "PT3M09.00S")).toBe("Q2 3:09");
    });
  });
});

/* ---------- formatGameTime ---------- */

describe("formatGameTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Today" prefix for a game later today', () => {
    // Fix "now" to 2025-03-01 12:00 local time
    const now = new Date(2025, 2, 1, 12, 0, 0);
    vi.setSystemTime(now);

    // Game at 7:00 PM same day
    const gameDate = new Date(2025, 2, 1, 19, 0, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).toMatch(/^Today /);
    expect(result).toContain("7:00");
    expect(result).toContain("PM");
  });

  it('returns "Tomorrow" prefix for a game tomorrow', () => {
    const now = new Date(2025, 2, 1, 12, 0, 0);
    vi.setSystemTime(now);

    // Game at 1:30 PM tomorrow
    const gameDate = new Date(2025, 2, 2, 13, 30, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).toMatch(/^Tomorrow /);
    expect(result).toContain("1:30");
    expect(result).toContain("PM");
  });

  it("returns short date for a game 3+ days in the future", () => {
    const now = new Date(2025, 2, 1, 12, 0, 0);
    vi.setSystemTime(now);

    // Game on Mar 15 at 9:00 PM
    const gameDate = new Date(2025, 2, 15, 21, 0, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).not.toMatch(/^Today/);
    expect(result).not.toMatch(/^Tomorrow/);
    expect(result).toContain("Mar");
    expect(result).toContain("15");
    expect(result).toContain("9:00");
    expect(result).toContain("PM");
  });

  it("formats AM times correctly for morning games", () => {
    const now = new Date(2025, 2, 1, 8, 0, 0);
    vi.setSystemTime(now);

    // Game at 11:00 AM same day
    const gameDate = new Date(2025, 2, 1, 11, 0, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).toMatch(/^Today /);
    expect(result).toContain("11:00");
    expect(result).toContain("AM");
  });

  it('returns "Today" for a game earlier today (past game same day)', () => {
    const now = new Date(2025, 2, 1, 22, 0, 0);
    vi.setSystemTime(now);

    // Game was at 1:00 PM today
    const gameDate = new Date(2025, 2, 1, 13, 0, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).toMatch(/^Today /);
    expect(result).toContain("1:00");
    expect(result).toContain("PM");
  });

  it("handles midnight boundary: game just after midnight is tomorrow", () => {
    // Now is 11:50 PM on Mar 1
    const now = new Date(2025, 2, 1, 23, 50, 0);
    vi.setSystemTime(now);

    // Game at 12:05 AM on Mar 2 (just after midnight)
    const gameDate = new Date(2025, 2, 2, 0, 5, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).toMatch(/^Tomorrow /);
    expect(result).toContain("12:05");
    expect(result).toContain("AM");
  });

  it("handles noon correctly", () => {
    const now = new Date(2025, 2, 1, 8, 0, 0);
    vi.setSystemTime(now);

    // Game at noon today
    const gameDate = new Date(2025, 2, 1, 12, 0, 0);
    const result = formatGameTime(gameDate.toISOString());

    expect(result).toMatch(/^Today /);
    expect(result).toContain("12:00");
    expect(result).toContain("PM");
  });

  it("returns short date for yesterday's game", () => {
    const now = new Date(2025, 2, 2, 12, 0, 0);
    vi.setSystemTime(now);

    // Game was yesterday at 7:00 PM
    const gameDate = new Date(2025, 2, 1, 19, 0, 0);
    const result = formatGameTime(gameDate.toISOString());

    // Yesterday is not special-cased; it should show short date
    expect(result).not.toMatch(/^Today/);
    expect(result).not.toMatch(/^Tomorrow/);
    expect(result).toContain("Mar");
    expect(result).toContain("1");
  });
});
