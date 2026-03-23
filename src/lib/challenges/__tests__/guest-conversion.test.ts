import { describe, it, expect, vi, beforeEach } from "vitest";
import { convertGuestChallenges } from "../guest-conversion";

// ---------------------------------------------------------------------------
// Mock Supabase admin client (Proxy-based, same pattern as guest-token.test.ts)
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

/**
 * Per-table query results. The mock routes calls to the correct table result
 * based on which table name was passed to `.from()`.
 */
let tableResults: Record<string, { data: unknown; error: unknown }> = {};
let currentTable = "";

/** Chainable query builder that resolves to the result for the current table. */
function createChainableQuery() {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(tableResults[currentTable] ?? { data: null, error: null });
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return (...args: unknown[]) => {
        if (prop === "insert") mockInsert(...args);
        if (prop === "select") mockSelect(...args);
        if (prop === "update") mockUpdate(...args);
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      currentTable = table;
      return createChainableQuery();
    },
  }),
}));

const mockCreateNotification = vi.fn();
vi.mock("@/lib/notifications/queries", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

const mockLogError = vi.fn();
const mockLogWarn = vi.fn();
const mockLogInfo = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
}));

beforeEach(() => {
  tableResults = {};
  currentTable = "";
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockSelect.mockClear();
  mockCreateNotification.mockClear();
  mockLogError.mockClear();
  mockLogWarn.mockClear();
  mockLogInfo.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setTokensResult(data: unknown[] | null, error: unknown = null) {
  tableResults["guest_tokens"] = { data, error };
}

function setChallengesResult(data: unknown[] | null, error: unknown = null) {
  tableResults["challenges"] = { data, error };
}

function setCardsResult(error: unknown = null) {
  tableResults["cards"] = { data: null, error };
}

function setProfilesResult(data: unknown = null, error: unknown = null) {
  tableResults["profiles"] = { data, error };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("convertGuestChallenges", () => {
  it("converts a challenge: sets opponent_id, links card, sends notification", async () => {
    setTokensResult([
      { token: "t1", challenge_id: "c1", email: "user@example.com", },
    ]);
    setChallengesResult([
      { id: "c1", challenger_id: "challenger-1", opponent_id: null, status: "pending" },
    ]);
    setCardsResult();
    setProfilesResult({ username: "NewUser" });
    mockCreateNotification.mockResolvedValue(undefined);

    const result = await convertGuestChallenges("user-1", "User@Example.com");

    expect(result).toEqual({ converted: 1 });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ opponent_id: "user-1" }));
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        user_id: "challenger-1",
        type: "challenge_accepted",
      }),
    );
  });

  it("deduplicates multiple tokens for the same challenge_id", async () => {
    setTokensResult([
      { token: "t1", challenge_id: "c1", email: "user@example.com", },
      { token: "t2", challenge_id: "c1", email: "user@example.com", },
    ]);
    setChallengesResult([
      { id: "c1", challenger_id: "challenger-1", opponent_id: null, status: "pending" },
    ]);
    setCardsResult();
    setProfilesResult({ username: "NewUser" });
    mockCreateNotification.mockResolvedValue(undefined);

    const result = await convertGuestChallenges("user-1", "user@example.com");

    expect(result).toEqual({ converted: 1 });
  });

  it("skips cancelled challenges", async () => {
    setTokensResult([
      { token: "t1", challenge_id: "c1", email: "user@example.com", },
    ]);
    setChallengesResult([
      { id: "c1", challenger_id: "challenger-1", opponent_id: null, status: "cancelled" },
    ]);

    const result = await convertGuestChallenges("user-1", "user@example.com");

    expect(result).toEqual({ converted: 0 });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("skips already-converted challenges (opponent_id already set)", async () => {
    setTokensResult([
      { token: "t1", challenge_id: "c1", email: "user@example.com", },
    ]);
    setChallengesResult([
      { id: "c1", challenger_id: "challenger-1", opponent_id: "existing-user", status: "pending" },
    ]);

    const result = await convertGuestChallenges("user-1", "user@example.com");

    expect(result).toEqual({ converted: 0 });
    expect(mockCreateNotification).not.toHaveBeenCalled();
  });

  it("returns { converted: 0 } when no tokens found for email", async () => {
    setTokensResult([]);

    const result = await convertGuestChallenges("user-1", "user@example.com");

    expect(result).toEqual({ converted: 0 });
  });

  it("returns { converted: 0 } and logs error on DB error fetching tokens", async () => {
    setTokensResult(null, { message: "DB error" });

    const result = await convertGuestChallenges("user-1", "user@example.com");

    expect(result).toEqual({ converted: 0 });
    expect(mockLogError).toHaveBeenCalledWith(
      "guest-conversion",
      "Failed to fetch guest tokens",
      "convertGuestChallenges",
      expect.objectContaining({ message: "DB error" }),
    );
  });

  it("logs warning on card linking failure but still increments converted", async () => {
    setTokensResult([
      { token: "t1", challenge_id: "c1", email: "user@example.com", },
    ]);
    setChallengesResult([
      { id: "c1", challenger_id: "challenger-1", opponent_id: null, status: "pending" },
    ]);
    // Card update will fail — set cards result with error
    setCardsResult({ message: "Card link failed" });
    setProfilesResult({ username: "NewUser" });
    mockCreateNotification.mockResolvedValue(undefined);

    const result = await convertGuestChallenges("user-1", "user@example.com");

    expect(result).toEqual({ converted: 1 });
    expect(mockLogWarn).toHaveBeenCalledWith(
      "guest-conversion",
      expect.stringContaining("Failed to link guest cards"),
      expect.objectContaining({ message: "Card link failed" }),
    );
  });
});
