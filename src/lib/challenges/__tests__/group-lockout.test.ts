import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bootNonActiveParticipantsAfterResolution,
  linkCardToParticipant,
  respondToGroupChallenge,
  ChallengeValidationError,
} from "../queries";

// ---------------------------------------------------------------------------
// Mock Supabase admin client (proxy-based)
// ---------------------------------------------------------------------------

interface QueryResult {
  data?: unknown;
  count?: number | null;
  error?: unknown;
}

let queryResults: Record<string, QueryResult> = {};
const mockUpdate = vi.fn();

function createChainableQuery(table: string) {
  let filterHint = "";
  let isCount = false;

  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        const result =
          queryResults[`${table}:${filterHint}`] ??
          queryResults[table] ??
          { data: null, count: null, error: null };
        return (resolve: (v: unknown) => void) => resolve(result);
      }
      if (prop === "catch" || prop === "finally") return undefined;
      return (...args: unknown[]) => {
        if (prop === "update") mockUpdate(table, ...args);
        if (prop === "single") filterHint = filterHint || "single";
        if (prop === "select" && args[1] && (args[1] as { count?: string }).count) {
          isCount = true;
          filterHint = "count";
        }
        if (prop === "in" && args[0] === "status") {
          filterHint = "status_in";
        }
        if (prop === "eq" && args[0] === "status" && args[1] === "resolved") {
          filterHint = "resolved_count";
        }
        if (prop === "eq" && args[0] === "status" && args[1] === "active") {
          filterHint = "active_others";
        }
        if (prop === "limit" && args[0] === 1 && !isCount && filterHint === "") {
          filterHint = "first_participant";
        }
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

const mockAdmin = {
  from: (table: string) => createChainableQuery(table),
} as never;

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
// bootNonActiveParticipantsAfterResolution
// ---------------------------------------------------------------------------

describe("bootNonActiveParticipantsAfterResolution", () => {
  it("does nothing for a 1v1 challenge", async () => {
    queryResults["challenges:single"] = {
      data: { id: "ch-1", lobby_type: "1v1", status: "active" },
      error: null,
    };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-1");

    expect(result.booted).toBe(0);
    expect(mockUpdate).not.toHaveBeenCalledWith(
      "challenge_participants",
      expect.anything(),
    );
  });

  it("does nothing for an already-resolved challenge", async () => {
    queryResults["challenges:single"] = {
      data: { id: "ch-1", lobby_type: "group", status: "resolved" },
      error: null,
    };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-1");

    expect(result.booted).toBe(0);
  });

  it("does nothing for an already-cancelled challenge", async () => {
    queryResults["challenges:single"] = {
      data: { id: "ch-1", lobby_type: "group", status: "cancelled" },
      error: null,
    };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-1");

    expect(result.booted).toBe(0);
  });

  it("boots invited and accepted participants for an active group challenge", async () => {
    queryResults["challenges:single"] = {
      data: { id: "ch-1", lobby_type: "group", status: "accepted" },
      error: null,
    };
    // Update with .in("status", ["invited", "accepted"]) returns the booted rows
    queryResults["challenge_participants:status_in"] = {
      data: [{ id: "p-1" }, { id: "p-2" }, { id: "p-3" }],
      error: null,
    };
    // Activation re-check fetches all participants — return some active
    queryResults["challenge_participants"] = {
      data: [
        { id: "active-1", status: "active" },
        { id: "active-2", status: "active" },
        { id: "p-1", status: "declined" },
      ],
      error: null,
    };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-1");

    expect(result.booted).toBe(3);
    // Verify the boot UPDATE was called with status: "declined"
    expect(mockUpdate).toHaveBeenCalledWith(
      "challenge_participants",
      expect.objectContaining({ status: "declined" }),
    );
  });

  it("returns 0 booted on subsequent calls (idempotent)", async () => {
    queryResults["challenges:single"] = {
      data: { id: "ch-1", lobby_type: "group", status: "active" },
      error: null,
    };
    // No invited/accepted left to boot
    queryResults["challenge_participants:status_in"] = { data: [], error: null };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-1");

    expect(result.booted).toBe(0);
  });

  it("returns 0 booted and logs on update error", async () => {
    queryResults["challenges:single"] = {
      data: { id: "ch-1", lobby_type: "group", status: "accepted" },
      error: null,
    };
    queryResults["challenge_participants:status_in"] = {
      data: null,
      error: { message: "DB error" },
    };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-1");

    expect(result.booted).toBe(0);
  });

  it("returns 0 booted on missing challenge", async () => {
    queryResults["challenges:single"] = {
      data: null,
      error: { message: "not found" },
    };

    const result = await bootNonActiveParticipantsAfterResolution(mockAdmin, "ch-missing");

    expect(result.booted).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// linkCardToParticipant lockout guards
// ---------------------------------------------------------------------------

describe("linkCardToParticipant lockout guards", () => {
  it("throws when the participant has been declined (booted)", async () => {
    queryResults["challenge_participants:first_participant"] = {
      data: [{ id: "p-1", status: "declined", is_creator: false }],
      error: null,
    };

    await expect(
      linkCardToParticipant(mockAdmin, "ch-1", "user-1", "card-1"),
    ).rejects.toBeInstanceOf(ChallengeValidationError);
    await expect(
      linkCardToParticipant(mockAdmin, "ch-1", "user-1", "card-1"),
    ).rejects.toThrow(/slot has been closed/);
  });

  it("throws when another card in the challenge has already resolved", async () => {
    queryResults["challenge_participants:first_participant"] = {
      data: [{ id: "p-1", status: "invited", is_creator: false }],
      error: null,
    };
    // Resolved-card count > 0
    queryResults["cards:resolved_count"] = { count: 1, error: null };

    await expect(
      linkCardToParticipant(mockAdmin, "ch-1", "user-1", "card-1"),
    ).rejects.toBeInstanceOf(ChallengeValidationError);
    await expect(
      linkCardToParticipant(mockAdmin, "ch-1", "user-1", "card-1"),
    ).rejects.toThrow(/already resolved/);
  });

  it("returns silently when no participant row exists (existing behavior)", async () => {
    queryResults["challenge_participants:first_participant"] = {
      data: [],
      error: null,
    };

    // Function logs and returns; should not throw
    await expect(
      linkCardToParticipant(mockAdmin, "ch-1", "user-1", "card-1"),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// respondToGroupChallenge cancel guard
// ---------------------------------------------------------------------------

describe("respondToGroupChallenge cancel guard", () => {
  it("throws when another participant is already active", async () => {
    queryResults["challenges:single"] = {
      data: {
        id: "ch-1",
        lobby_type: "group",
        status: "accepted",
        challenger_id: "creator",
        game_mode: "classic",
      },
      error: null,
    };
    // First participant query: the creator's row
    queryResults["challenge_participants:first_participant"] = {
      data: [{ id: "p-creator", status: "invited", is_creator: true }],
      error: null,
    };
    // Other-active query: someone else has locked in
    queryResults["challenge_participants:active_others"] = {
      data: [{ id: "p-other" }],
      error: null,
    };

    await expect(
      respondToGroupChallenge(mockAdmin, "ch-1", "creator", "cancel"),
    ).rejects.toBeInstanceOf(ChallengeValidationError);
    await expect(
      respondToGroupChallenge(mockAdmin, "ch-1", "creator", "cancel"),
    ).rejects.toThrow(/other players have already locked in/i);
  });

  it("throws when a non-creator tries to cancel", async () => {
    queryResults["challenges:single"] = {
      data: {
        id: "ch-1",
        lobby_type: "group",
        status: "accepted",
        challenger_id: "creator",
        game_mode: "classic",
      },
      error: null,
    };
    queryResults["challenge_participants:first_participant"] = {
      data: [{ id: "p-1", status: "invited", is_creator: false }],
      error: null,
    };

    await expect(
      respondToGroupChallenge(mockAdmin, "ch-1", "non-creator", "cancel"),
    ).rejects.toThrow(/Only the challenge creator can cancel/);
  });
});
