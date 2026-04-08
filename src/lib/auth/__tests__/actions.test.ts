import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (set up before importing the module under test)
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockIlike = vi.fn();
const mockMaybeSingle = vi.fn();
const mockCreateUser = vi.fn();

// Per-table results so the chainable Proxy resolves to the right data.
let tableResults: Record<string, { data: unknown; error: unknown }> = {};
let updateResult: { error: unknown } = { error: null };
let upsertResult: { error: unknown } = { error: null };
let _currentTable = "";
let currentUser: { id: string; email: string } | null = null;

function createChainableQuery(tableName: string) {
  // Each chainable returns a new proxy so async terminators (`then`) resolve
  // to the per-table result without leaking state across parallel calls.
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          // .update().eq() should resolve to updateResult
          if (mockUpdate.mock.calls.length > 0 && tableName === "profiles") {
            return resolve(updateResult);
          }
          return resolve(tableResults[tableName] ?? { data: null, error: null });
        };
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return (...args: unknown[]) => {
        if (prop === "select") mockSelect(...args);
        if (prop === "update") mockUpdate(...args);
        if (prop === "upsert") {
          mockUpsert(...args);
          return Promise.resolve(upsertResult);
        }
        if (prop === "eq") mockEq(...args);
        if (prop === "neq") mockNeq(...args);
        if (prop === "ilike") mockIlike(...args);
        if (prop === "maybeSingle") {
          mockMaybeSingle(...args);
          return Promise.resolve(tableResults[tableName] ?? { data: null });
        }
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      _currentTable = table;
      return createChainableQuery(table);
    },
    auth: {
      admin: {
        createUser: (...args: unknown[]) => mockCreateUser(...args),
        getUserById: vi.fn(),
      },
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: currentUser } }),
      signOut: vi.fn(),
    },
    from: (table: string) => {
      _currentTable = table;
      return createChainableQuery(table);
    },
  }),
}));

vi.mock("@/lib/auth/claim-cards", () => ({
  claimAnonymousCards: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Import after all mocks are wired up
import { dismissUsernamePrompt, updateUsername, signUp } from "../actions";

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  tableResults = {};
  updateResult = { error: null };
  upsertResult = { error: null };
  _currentTable = "";
  currentUser = null;
  mockUpdate.mockClear();
  mockUpsert.mockClear();
  mockSelect.mockClear();
  mockEq.mockClear();
  mockNeq.mockClear();
  mockIlike.mockClear();
  mockMaybeSingle.mockClear();
  mockCreateUser.mockClear();
});

// ---------------------------------------------------------------------------
// dismissUsernamePrompt
// ---------------------------------------------------------------------------

describe("dismissUsernamePrompt", () => {
  it("returns an error when the user is not authenticated", async () => {
    currentUser = null;

    const result = await dismissUsernamePrompt();

    expect(result).toEqual({ error: "Not authenticated" });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("sets username_chosen_at to a timestamp on the current user's profile", async () => {
    currentUser = { id: "user-1", email: "u@example.com" };

    const result = await dismissUsernamePrompt();

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const updatePayload = mockUpdate.mock.calls[0][0] as {
      username_chosen_at: string;
    };
    expect(updatePayload.username_chosen_at).toBeDefined();
    // Should be a parseable ISO timestamp
    expect(() => new Date(updatePayload.username_chosen_at)).not.toThrow();
    expect(mockEq).toHaveBeenCalledWith("id", "user-1");
  });

  it("does not include username in the update payload — only the timestamp", async () => {
    currentUser = { id: "user-2", email: "u@example.com" };

    await dismissUsernamePrompt();

    const updatePayload = mockUpdate.mock.calls[0][0] as Record<string, unknown>;
    expect(updatePayload).not.toHaveProperty("username");
    expect(Object.keys(updatePayload)).toEqual(["username_chosen_at"]);
  });

  it("returns a structured error when the DB update fails", async () => {
    currentUser = { id: "user-3", email: "u@example.com" };
    updateResult = { error: { message: "boom" } };

    const result = await dismissUsernamePrompt();

    expect(result).toEqual({ error: "Failed to dismiss prompt" });
  });
});

// ---------------------------------------------------------------------------
// updateUsername — verify it stamps username_chosen_at
// ---------------------------------------------------------------------------

describe("updateUsername", () => {
  it("rejects invalid username formats before touching the DB", async () => {
    currentUser = { id: "user-4", email: "u@example.com" };

    const result = await updateUsername("ab"); // too short

    expect(result.error).toMatch(/3-20 characters/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns an error when the user is not authenticated", async () => {
    currentUser = null;

    const result = await updateUsername("validname");

    expect(result.error).toBe("Not authenticated");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("stamps username_chosen_at alongside the new username", async () => {
    currentUser = { id: "user-5", email: "u@example.com" };
    // No conflicting username
    tableResults["profiles"] = { data: null, error: null };

    const result = await updateUsername("newname");

    expect(result).toEqual({ success: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const payload = mockUpdate.mock.calls[0][0] as {
      username: string;
      username_chosen_at: string;
    };
    expect(payload.username).toBe("newname");
    expect(payload.username_chosen_at).toBeDefined();
    expect(() => new Date(payload.username_chosen_at)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// signUp — verify the profile upsert stamps username_chosen_at
// ---------------------------------------------------------------------------

describe("signUp", () => {
  function buildFormData(fields: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v);
    return fd;
  }

  it("rejects missing fields", async () => {
    const result = await signUp(buildFormData({ email: "a@b.com" }));
    expect(result.error).toBe("All fields are required");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("rejects short passwords", async () => {
    const result = await signUp(
      buildFormData({ email: "a@b.com", password: "12345", username: "alice" }),
    );
    expect(result.error).toMatch(/at least 6/);
  });

  it("rejects invalid usernames", async () => {
    const result = await signUp(
      buildFormData({ email: "a@b.com", password: "abcdef", username: "ab" }),
    );
    expect(result.error).toMatch(/3-20 characters/);
  });

  it("stamps username_chosen_at on the profile upsert when signup succeeds", async () => {
    // No conflicting username
    tableResults["profiles"] = { data: null, error: null };
    mockCreateUser.mockResolvedValueOnce({
      data: { user: { id: "new-user" } },
      error: null,
    });

    const result = await signUp(
      buildFormData({ email: "a@b.com", password: "abcdef", username: "alice" }),
    );

    expect(result).toEqual({ success: true });
    expect(mockUpsert).toHaveBeenCalled();
    const upsertPayload = mockUpsert.mock.calls[0][0] as {
      id: string;
      username: string;
      username_chosen_at: string;
    };
    expect(upsertPayload.id).toBe("new-user");
    expect(upsertPayload.username).toBe("alice");
    expect(upsertPayload.username_chosen_at).toBeDefined();
    expect(() => new Date(upsertPayload.username_chosen_at)).not.toThrow();
  });
});
