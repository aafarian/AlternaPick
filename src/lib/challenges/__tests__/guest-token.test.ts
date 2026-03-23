import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createGuestToken,
  verifyGuestToken,
  markTokenUsed,
} from "../guest-token";

// ---------------------------------------------------------------------------
// Mock Supabase admin client
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();

/** Chainable query builder that resolves to queryResult when awaited. */
function createChainableQuery() {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      // Make the proxy thenable so `await chain` resolves to queryResult
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(queryResult);
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

let queryResult: { data: unknown; error: unknown } = { data: null, error: null };

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => createChainableQuery(),
  }),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

// Stable UUID for tests
vi.mock("crypto", async () => {
  const actual = await vi.importActual("crypto");
  return {
    ...actual,
    randomUUID: () => "00000000-0000-0000-0000-000000000001",
  };
});

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://alternapick.com");
  queryResult = { data: null, error: null };
  mockInsert.mockClear();
  mockUpdate.mockClear();
  mockSelect.mockClear();
});

// ---------------------------------------------------------------------------
// createGuestToken
// ---------------------------------------------------------------------------

describe("createGuestToken", () => {
  it("returns a token and URL on success", async () => {
    queryResult = { data: null, error: null };

    const result = await createGuestToken("challenge-123", "User@Example.com");

    expect(result.token).toBe("00000000-0000-0000-0000-000000000001");
    expect(result.url).toBe(
      "https://alternapick.com/challenges/challenge-123/guest?token=00000000-0000-0000-0000-000000000001",
    );
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "00000000-0000-0000-0000-000000000001",
        challenge_id: "challenge-123",
        email: "user@example.com",
      }),
    );
  });

  it("throws when DB insert fails", async () => {
    queryResult = { data: null, error: { message: "DB error" } };

    await expect(
      createGuestToken("challenge-123", "user@example.com"),
    ).rejects.toThrow("Failed to create guest token");
  });
});

// ---------------------------------------------------------------------------
// verifyGuestToken
// ---------------------------------------------------------------------------

describe("verifyGuestToken", () => {
  it("returns challengeId and email for valid token", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    queryResult = {
      data: {
        challenge_id: "challenge-123",
        email: "user@example.com",
        expires_at: futureDate.toISOString(),
        used_at: null,
      },
      error: null,
    };

    const result = await verifyGuestToken("valid-token");
    expect(result).toEqual({
      challengeId: "challenge-123",
      email: "user@example.com",
    });
  });

  it("returns null for non-existent token", async () => {
    queryResult = { data: null, error: null };

    const result = await verifyGuestToken("non-existent");
    expect(result).toBeNull();
  });

  it("returns null for expired token", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 1);

    queryResult = {
      data: {
        challenge_id: "challenge-123",
        email: "user@example.com",
        expires_at: pastDate.toISOString(),
        used_at: null,
      },
      error: null,
    };

    const result = await verifyGuestToken("expired-token");
    expect(result).toBeNull();
  });

  it("returns null for used token", async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);

    queryResult = {
      data: {
        challenge_id: "challenge-123",
        email: "user@example.com",
        expires_at: futureDate.toISOString(),
        used_at: new Date().toISOString(),
      },
      error: null,
    };

    const result = await verifyGuestToken("used-token");
    expect(result).toBeNull();
  });

  it("returns null on DB error", async () => {
    queryResult = { data: null, error: { message: "DB error" } };

    const result = await verifyGuestToken("any-token");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// markTokenUsed
// ---------------------------------------------------------------------------

describe("markTokenUsed", () => {
  it("returns true when token is successfully claimed", async () => {
    queryResult = { data: { token: "token-123" }, error: null };

    const result = await markTokenUsed("token-123");
    expect(result).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ used_at: expect.any(String) }),
    );
  });

  it("returns false when token was already consumed", async () => {
    queryResult = { data: null, error: null };

    const result = await markTokenUsed("token-123");
    expect(result).toBe(false);
  });

  it("throws on DB error", async () => {
    queryResult = { data: null, error: { message: "DB error" } };

    await expect(markTokenUsed("token-123")).rejects.toThrow(
      "Failed to mark token as used",
    );
  });
});

