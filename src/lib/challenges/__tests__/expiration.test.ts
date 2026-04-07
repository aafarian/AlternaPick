import { describe, it, expect, vi, beforeEach } from "vitest";
import { expireStaleChallenges } from "../queries";

// ---------------------------------------------------------------------------
// Mock Supabase admin client (Proxy-based, per-table results)
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn();

/**
 * Per-table, per-query results. The mock routes calls based on the table name
 * and the filter chain applied to the query.
 *
 * Keys follow the pattern: `table` or `table:filter_hint` where filter_hint
 * helps disambiguate multiple queries to the same table.
 */
let queryResults: Record<string, { data: unknown; error: unknown }> = {};
/** Track the filter chain to route to the right result. */
function createChainableQuery(table: string) {
  let filterHint = "";

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        // Resolve in priority: table:hint → table → fallback
        const result =
          queryResults[`${table}:${filterHint}`] ??
          queryResults[table] ??
          { data: null, error: null };
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return (...args: unknown[]) => {
        if (prop === "update") mockUpdate(...args);
        // Build filter hints from common filter methods
        if (prop === "eq" && args[0] === "user_id") {
          filterHint = `user_id=${args[1]}`;
        }
        if (prop === "lt") {
          filterHint = "time_cutoff";
        }
        if (prop === "in" && args[0] === "id") {
          filterHint = "by_ids";
        }
        if (prop === "eq" && args[0] === "status" && args[1] === "active") {
          filterHint = "active_only";
        }
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

const mockAdmin = {
  from: (table: string) => createChainableQuery(table),
} as any;

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

beforeEach(() => {
  queryResults = {};
  mockUpdate.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const futureDate = new Date(Date.now() + ONE_DAY_MS).toISOString();
const pastDate = new Date(Date.now() - 60_000).toISOString();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("expireStaleChallenges", () => {
  describe("Trigger 1: Time-based (24h)", () => {
    it("cancels draft/pending/accepted challenges older than 24h", async () => {
      queryResults["challenges:time_cutoff"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic" },
          { id: "ch-2", challenger_id: "user-b", game_mode: "mirror" },
        ],
        error: null,
      };
      // Pending challenges query (triggers 2 & 3) — empty
      queryResults["challenges"] = { data: [], error: null };
      // Card queries for solo conversion
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(2);
      // Both challenges had cards to convert
      expect(result.converted).toBe(2);
    });

    it("skips solo conversion for sabotage mode", async () => {
      queryResults["challenges:time_cutoff"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "sabotage" },
        ],
        error: null,
      };
      queryResults["challenges"] = { data: [], error: null };
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(1);
      expect(result.converted).toBe(0);
    });

    it("handles no stale challenges gracefully", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = { data: [], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(0);
      expect(result.converted).toBe(0);
    });

    it("handles null query result gracefully", async () => {
      queryResults["challenges:time_cutoff"] = { data: null, error: null };
      queryResults["challenges"] = { data: null, error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(0);
      expect(result.converted).toBe(0);
    });
  });

  describe("Trigger 2: Challenger card resolved", () => {
    it("cancels when challenger card is resolved and opponent hasn't responded", async () => {
      // No time-based stale challenges
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      // Pending challenge
      queryResults["challenges"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic", mirror_props: null },
        ],
        error: null,
      };
      // Challenger's card is resolved
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "resolved" }],
        error: null,
      };
      // Default card query for solo conversion
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(1);
      expect(result.converted).toBe(1);
    });

    it("does NOT cancel when challenger card is still locked", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic", mirror_props: null },
        ],
        error: null,
      };
      // Challenger's card still locked (games in progress)
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "locked" }],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(0);
      expect(result.converted).toBe(0);
    });

    it("does NOT cancel when challenger has no card yet", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "mirror", mirror_props: null },
        ],
        error: null,
      };
      // No card for challenger
      queryResults["cards:user_id=user-a"] = { data: [], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(0);
    });

    it("skips challenges already processed by trigger 1", async () => {
      // Same challenge caught by time-based trigger
      queryResults["challenges:time_cutoff"] = {
        data: [{ id: "ch-1", challenger_id: "user-a", game_mode: "classic" }],
        error: null,
      };
      queryResults["challenges"] = {
        data: [{ id: "ch-1", challenger_id: "user-a", game_mode: "classic", mirror_props: null }],
        error: null,
      };
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "resolved" }],
        error: null,
      };
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      // Should only count once (from trigger 1), not double-counted
      expect(result.expired).toBe(1);
    });
  });

  describe("Trigger 3: All mirror_props expired", () => {
    it("cancels mirror challenge when all props have started", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          {
            id: "ch-1",
            challenger_id: "user-a",
            game_mode: "mirror",
            mirror_props: ["p1", "p2", "p3"],
          },
        ],
        error: null,
      };
      // Challenger's card NOT resolved (so trigger 2 doesn't fire)
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "locked" }],
        error: null,
      };
      // All props have started
      queryResults["props:by_ids"] = {
        data: [
          { id: "p1", games: { commence_time: pastDate } },
          { id: "p2", games: { commence_time: pastDate } },
          { id: "p3", games: { commence_time: pastDate } },
        ],
        error: null,
      };
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(1);
      expect(result.converted).toBe(1);
    });

    it("does NOT cancel when some props are still in the future", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          {
            id: "ch-1",
            challenger_id: "user-a",
            game_mode: "random",
            mirror_props: ["p1", "p2", "p3"],
          },
        ],
        error: null,
      };
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "locked" }],
        error: null,
      };
      // Only 2 of 3 props have started — 1 still in the future
      queryResults["props:by_ids"] = {
        data: [
          { id: "p1", games: { commence_time: pastDate } },
          { id: "p2", games: { commence_time: pastDate } },
          { id: "p3", games: { commence_time: futureDate } },
        ],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(0);
      expect(result.converted).toBe(0);
    });

    it("skips challenges with no mirror_props (classic/sabotage)", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic", mirror_props: null },
        ],
        error: null,
      };
      // Challenger's card not resolved
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "locked" }],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      // No trigger fires: not old enough (trigger 1), card not resolved (trigger 2),
      // no mirror_props (trigger 3)
      expect(result.expired).toBe(0);
    });

    it("skips challenges already processed by trigger 2", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          {
            id: "ch-1",
            challenger_id: "user-a",
            game_mode: "mirror",
            mirror_props: ["p1", "p2"],
          },
        ],
        error: null,
      };
      // Challenger's card resolved (trigger 2 fires)
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "resolved" }],
        error: null,
      };
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };
      // All props also started (trigger 3 would fire too)
      queryResults["props:by_ids"] = {
        data: [
          { id: "p1", games: { commence_time: pastDate } },
          { id: "p2", games: { commence_time: pastDate } },
        ],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      // Counted once from trigger 2, not double-counted by trigger 3
      expect(result.expired).toBe(1);
    });
  });

  describe("Group challenge guard", () => {
    it("does NOT cancel a stale group challenge that has any active participants", async () => {
      // Group challenge older than 24h, would normally be cancelled by Trigger 1.
      queryResults["challenges:time_cutoff"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic", lobby_type: "group" },
        ],
        error: null,
      };
      queryResults["challenges"] = { data: [], error: null };
      // At least one participant has locked in (status = "active")
      queryResults["challenge_participants:active_only"] = {
        data: [{ id: "p-1" }],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      // Skipped — not cancelled
      expect(result.expired).toBe(0);
    });

    it("DOES cancel a stale group challenge with no active participants", async () => {
      queryResults["challenges:time_cutoff"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic", lobby_type: "group" },
        ],
        error: null,
      };
      queryResults["challenges"] = { data: [], error: null };
      // No active participants
      queryResults["challenge_participants:active_only"] = { data: [], error: null };
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(1);
    });

    it("trigger 2 also skips group challenges with active participants", async () => {
      queryResults["challenges:time_cutoff"] = { data: [], error: null };
      queryResults["challenges"] = {
        data: [
          {
            id: "ch-1",
            challenger_id: "user-a",
            game_mode: "classic",
            mirror_props: null,
            lobby_type: "group",
          },
        ],
        error: null,
      };
      // Challenger card is resolved (would normally trigger 2)
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "resolved" }],
        error: null,
      };
      // But there are active group participants — skip
      queryResults["challenge_participants:active_only"] = {
        data: [{ id: "p-1" }],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(0);
    });

    it("fails safe (skips cancel) when the active-participant check errors", async () => {
      // Bug we're guarding against: if the DB query fails, the previous
      // implementation returned false and proceeded to cancel — exactly the
      // opposite of what we want for a defensive guard.
      queryResults["challenges:time_cutoff"] = {
        data: [
          { id: "ch-1", challenger_id: "user-a", game_mode: "classic", lobby_type: "group" },
        ],
        error: null,
      };
      queryResults["challenges"] = { data: [], error: null };
      queryResults["challenge_participants:active_only"] = {
        data: null,
        error: { message: "DB hiccup" },
      };

      const result = await expireStaleChallenges(mockAdmin);

      // Skipped — fail-safe means we DON'T cancel on a DB error
      expect(result.expired).toBe(0);
    });
  });

  describe("Cross-trigger: no double counting", () => {
    it("a challenge is only expired once even if multiple triggers match", async () => {
      // Old challenge (trigger 1) with resolved card (trigger 2) and all props started (trigger 3)
      queryResults["challenges:time_cutoff"] = {
        data: [
          {
            id: "ch-1",
            challenger_id: "user-a",
            game_mode: "mirror",
          },
        ],
        error: null,
      };
      queryResults["challenges"] = {
        data: [
          {
            id: "ch-1",
            challenger_id: "user-a",
            game_mode: "mirror",
            mirror_props: ["p1"],
          },
        ],
        error: null,
      };
      queryResults["cards:user_id=user-a"] = {
        data: [{ id: "card-1", status: "resolved" }],
        error: null,
      };
      queryResults["cards"] = { data: [{ id: "card-1" }], error: null };
      queryResults["props:by_ids"] = {
        data: [{ id: "p1", games: { commence_time: pastDate } }],
        error: null,
      };

      const result = await expireStaleChallenges(mockAdmin);

      expect(result.expired).toBe(1);
      expect(result.converted).toBe(1);
    });
  });
});
