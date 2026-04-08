import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDeleteUser = vi.fn();
const mockLogError = vi.fn();
const mockLogInfo = vi.fn();
const mockLogWarn = vi.fn();

const mockUpdate = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logInfo: (...args: unknown[]) => mockLogInfo(...args),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));

import { hardDeleteAccount, transferGroupOwnership } from "../delete";

// ---------------------------------------------------------------------------
// Per-table results for the proxy mock
// ---------------------------------------------------------------------------

let challengesResult: { data: unknown; error: unknown } = { data: [], error: null };
let participantsResult: { data: unknown; error: unknown } = { data: [], error: null };
let updateResults: { error: unknown }[] = [];
let updateResultIndex = 0;

function nextUpdateResult() {
  const result = updateResults[updateResultIndex] ?? { error: null };
  updateResultIndex++;
  return result;
}

/**
 * Chainable proxy that resolves differently depending on whether the chain
 * began with a `select` (read) or `update` (write).
 */
function createChainable(table: string) {
  let isUpdate = false;

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          if (isUpdate) {
            return resolve(nextUpdateResult());
          }
          if (table === "challenges") return resolve(challengesResult);
          if (table === "challenge_participants") return resolve(participantsResult);
          return resolve({ data: null, error: null });
        };
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return (...args: unknown[]) => {
        if (prop === "select") mockSelect(table, ...args);
        if (prop === "update") {
          mockUpdate(table, ...args);
          isUpdate = true;
        }
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

function fakeAdmin() {
  return {
    from: (table: string) => createChainable(table),
    auth: {
      admin: {
        deleteUser: (...args: unknown[]) => mockDeleteUser(...args),
      },
    },
  } as unknown as Parameters<typeof hardDeleteAccount>[0];
}

beforeEach(() => {
  mockDeleteUser.mockClear();
  mockLogError.mockClear();
  mockLogInfo.mockClear();
  mockLogWarn.mockClear();
  mockUpdate.mockClear();
  mockSelect.mockClear();
  challengesResult = { data: [], error: null };
  participantsResult = { data: [], error: null };
  updateResults = [];
  updateResultIndex = 0;
});

// ---------------------------------------------------------------------------
// hardDeleteAccount — happy path and failure handling
// ---------------------------------------------------------------------------

describe("hardDeleteAccount", () => {
  it("calls auth.admin.deleteUser with the user id", async () => {
    mockDeleteUser.mockResolvedValueOnce({ error: null });

    const result = await hardDeleteAccount(fakeAdmin(), "user-123");

    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
    expect(result).toEqual({ success: true });
  });

  it("returns an error result and logs when the auth delete fails", async () => {
    mockDeleteUser.mockResolvedValueOnce({ error: { message: "boom" } });

    const result = await hardDeleteAccount(fakeAdmin(), "user-456");

    expect(result.success).toBe(false);
    expect(result.error).toBe("boom");
    expect(mockLogError).toHaveBeenCalled();
    const errorCalls = mockLogError.mock.calls;
    const accountDeleteCall = errorCalls.find((c) => c[0] === "account-delete");
    expect(accountDeleteCall).toBeDefined();
    expect(accountDeleteCall![1]).toContain("user-456");
    expect(accountDeleteCall![1]).toContain("boom");
  });

  it("logs info on successful delete (audit trail)", async () => {
    mockDeleteUser.mockResolvedValueOnce({ error: null });

    await hardDeleteAccount(fakeAdmin(), "user-789");

    const infoCalls = mockLogInfo.mock.calls.filter((c) => c[0] === "account-delete");
    expect(infoCalls.some((c) => (c[1] as string).includes("user-789"))).toBe(true);
  });

  it("does not log success on a failed delete", async () => {
    mockDeleteUser.mockResolvedValueOnce({ error: { message: "fail" } });

    await hardDeleteAccount(fakeAdmin(), "user-x");

    // Filter to only the "Hard-deleted user" log line, not the
    // "Transferred ownership" line which may or may not fire.
    const successLog = mockLogInfo.mock.calls.find(
      (c) => typeof c[1] === "string" && (c[1] as string).startsWith("Hard-deleted"),
    );
    expect(successLog).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// transferGroupOwnership — group challenge protection
// ---------------------------------------------------------------------------

describe("transferGroupOwnership", () => {
  it("transfers ownership to another participant when one exists", async () => {
    challengesResult = {
      data: [{ id: "ch-1" }],
      error: null,
    };
    participantsResult = {
      data: [
        { user_id: "new-owner", is_creator: false, created_at: "2026-01-01" },
      ],
      error: null,
    };
    updateResults = [{ error: null }, { error: null }];

    const result = await transferGroupOwnership(fakeAdmin(), "old-owner");

    expect(result.transferred).toBe(1);
    // First update sets the new challenger_id on challenges
    const challengeUpdate = mockUpdate.mock.calls.find(
      (c) => c[0] === "challenges",
    );
    expect(challengeUpdate).toBeDefined();
    expect(challengeUpdate![1]).toEqual({ challenger_id: "new-owner" });
    // Second update marks the new owner as creator on challenge_participants
    const participantUpdate = mockUpdate.mock.calls.find(
      (c) => c[0] === "challenge_participants",
    );
    expect(participantUpdate).toBeDefined();
    expect(participantUpdate![1]).toEqual({ is_creator: true });
  });

  it("does NOT transfer when there are no other participants (lets cascade delete the empty group)", async () => {
    challengesResult = {
      data: [{ id: "ch-empty" }],
      error: null,
    };
    participantsResult = { data: [], error: null };

    const result = await transferGroupOwnership(fakeAdmin(), "lonely-user");

    expect(result.transferred).toBe(0);
    // No update calls — we let the cascade handle it
    const challengeUpdates = mockUpdate.mock.calls.filter(
      (c) => c[0] === "challenges",
    );
    expect(challengeUpdates).toHaveLength(0);
  });

  it("returns transferred=0 when the user owns no group challenges", async () => {
    challengesResult = { data: [], error: null };

    const result = await transferGroupOwnership(fakeAdmin(), "user-no-groups");

    expect(result.transferred).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("logs and returns 0 when the initial fetch fails", async () => {
    challengesResult = { data: null, error: { message: "db fail" } };

    const result = await transferGroupOwnership(fakeAdmin(), "user-err");

    expect(result.transferred).toBe(0);
    expect(mockLogError).toHaveBeenCalled();
  });

  it("counts a successful transfer even when marking is_creator on participants fails (non-fatal)", async () => {
    challengesResult = { data: [{ id: "ch-2" }], error: null };
    participantsResult = {
      data: [{ user_id: "promoted", is_creator: false, created_at: "2026-01-02" }],
      error: null,
    };
    // First update (challenges) succeeds, second update (participants) fails
    updateResults = [{ error: null }, { error: { message: "secondary fail" } }];

    const result = await transferGroupOwnership(fakeAdmin(), "old-owner-2");

    expect(result.transferred).toBe(1);
    expect(mockLogWarn).toHaveBeenCalled();
  });
});
