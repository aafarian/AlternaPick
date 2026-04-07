import { describe, it, expect, vi, beforeEach } from "vitest";
import { bootNonActiveParticipantsAfterResolution } from "../queries";

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
        if (prop === "single") filterHint = "single";
        if (prop === "in" && args[0] === "status") {
          filterHint = "status_in";
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
