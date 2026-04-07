import { describe, it, expect, vi, beforeEach } from "vitest";
import { getUnreadCounts } from "../queries";

// ---------------------------------------------------------------------------
// Mock Supabase client (proxy-based, same pattern as guest-conversion.test.ts)
// ---------------------------------------------------------------------------

interface QueryResult {
  data?: unknown;
  count?: number | null;
  error?: unknown;
}

// Per-table query results, keyed by table name.
let tableResults: Record<string, QueryResult> = {};
let currentTable = "";

function createChainableQuery() {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) =>
          resolve(tableResults[currentTable] ?? { data: null, count: null, error: null });
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

const mockSupabase = {
  from: (table: string) => {
    currentTable = table;
    return createChainableQuery();
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      currentTable = table;
      return createChainableQuery();
    },
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setResult(table: string, result: QueryResult) {
  tableResults[table] = result;
}

beforeEach(() => {
  tableResults = {};
  currentTable = "";
  // Default empty/zero results so tests don't blow up on tables they don't care about
  setResult("friendships", { count: 0, error: null });
  setResult("challenges", { count: 0, error: null });
  setResult("challenge_participants", { count: 0, error: null });
  setResult("notifications", { count: 0, error: null });
  setResult("profiles", { data: { analytics_last_seen_at: null, wrapped_last_seen_at: null }, error: null });
  setResult("cards", { count: 0, error: null });
  setResult("recaps", { count: 0, error: null });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getUnreadCounts", () => {
  describe("base counts", () => {
    it("returns zero counts when no pending data", async () => {
      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result).toEqual({
        pendingFriendRequests: 0,
        pendingChallenges: 0,
        unreadNotifications: 0,
        analyticsUnseen: false,
        wrappedUnseen: false,
      });
    });

    it("returns pending friend requests count", async () => {
      setResult("friendships", { count: 3, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.pendingFriendRequests).toBe(3);
    });

    it("sums 1v1 and group challenge invites into pendingChallenges", async () => {
      setResult("challenges", { count: 2, error: null });
      setResult("challenge_participants", { count: 5, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.pendingChallenges).toBe(7);
    });

    it("returns unread notifications count", async () => {
      setResult("notifications", { count: 4, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.unreadNotifications).toBe(4);
    });
  });

  describe("error handling", () => {
    it("throws if friend request query fails", async () => {
      setResult("friendships", { count: null, error: { message: "DB down" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to count pending friend requests");
    });

    it("throws if 1v1 challenge query fails", async () => {
      setResult("challenges", { count: null, error: { message: "DB down" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to count pending challenges");
    });

    it("throws if group challenge query fails", async () => {
      setResult("challenge_participants", { count: null, error: { message: "DB down" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to count group challenge invites");
    });

    it("throws if notifications query fails", async () => {
      setResult("notifications", { count: null, error: { message: "DB down" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to count unread notifications");
    });

    it("throws if profile query fails (prevents permanently visible dots)", async () => {
      setResult("profiles", { data: null, error: { message: "RLS denied" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to fetch profile last-seen timestamps");
    });

    it("throws if cards query fails", async () => {
      setResult("cards", { count: null, error: { message: "DB down" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to count new resolved cards");
    });

    it("throws if recaps query fails", async () => {
      setResult("recaps", { count: null, error: { message: "DB down" } });

      await expect(
        getUnreadCounts(mockSupabase as never, "user-1")
      ).rejects.toThrow("Failed to count new weekly recaps");
    });
  });

  describe("analyticsUnseen", () => {
    it("is false when user has no resolved cards", async () => {
      setResult("cards", { count: 0, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.analyticsUnseen).toBe(false);
    });

    it("is true when there are resolved cards and user has never visited analytics", async () => {
      setResult("profiles", { data: { analytics_last_seen_at: null, wrapped_last_seen_at: null }, error: null });
      setResult("cards", { count: 3, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.analyticsUnseen).toBe(true);
    });

    it("is true when there are cards resolved after last seen", async () => {
      setResult("profiles", {
        data: { analytics_last_seen_at: "2026-04-01T00:00:00Z", wrapped_last_seen_at: null },
        error: null,
      });
      setResult("cards", { count: 1, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.analyticsUnseen).toBe(true);
    });

    it("is false when no new cards resolved since last seen", async () => {
      setResult("profiles", {
        data: { analytics_last_seen_at: "2026-04-01T00:00:00Z", wrapped_last_seen_at: null },
        error: null,
      });
      setResult("cards", { count: 0, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.analyticsUnseen).toBe(false);
    });
  });

  describe("wrappedUnseen", () => {
    it("is false when no weekly recaps exist", async () => {
      setResult("recaps", { count: 0, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.wrappedUnseen).toBe(false);
    });

    it("is true when weekly recap exists and user has never visited wrapped", async () => {
      setResult("profiles", { data: { analytics_last_seen_at: null, wrapped_last_seen_at: null }, error: null });
      setResult("recaps", { count: 1, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.wrappedUnseen).toBe(true);
    });

    it("is true when new weekly recap was computed after last seen", async () => {
      setResult("profiles", {
        data: { analytics_last_seen_at: null, wrapped_last_seen_at: "2026-04-01T00:00:00Z" },
        error: null,
      });
      setResult("recaps", { count: 1, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.wrappedUnseen).toBe(true);
    });

    it("is false when no new recaps computed since last seen", async () => {
      setResult("profiles", {
        data: { analytics_last_seen_at: null, wrapped_last_seen_at: "2026-04-01T00:00:00Z" },
        error: null,
      });
      setResult("recaps", { count: 0, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result.wrappedUnseen).toBe(false);
    });
  });

  describe("integration", () => {
    it("returns all fields correctly when everything is populated", async () => {
      setResult("friendships", { count: 2, error: null });
      setResult("challenges", { count: 1, error: null });
      setResult("challenge_participants", { count: 3, error: null });
      setResult("notifications", { count: 5, error: null });
      setResult("profiles", {
        data: { analytics_last_seen_at: "2026-04-01T00:00:00Z", wrapped_last_seen_at: "2026-04-01T00:00:00Z" },
        error: null,
      });
      setResult("cards", { count: 2, error: null });
      setResult("recaps", { count: 1, error: null });

      const result = await getUnreadCounts(mockSupabase as never, "user-1");

      expect(result).toEqual({
        pendingFriendRequests: 2,
        pendingChallenges: 4,
        unreadNotifications: 5,
        analyticsUnseen: true,
        wrappedUnseen: true,
      });
    });
  });
});
