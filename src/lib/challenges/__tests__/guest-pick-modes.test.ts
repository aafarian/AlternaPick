/**
 * Tests for guest-pick API supporting all game modes.
 *
 * Validates that:
 * - Mirror/random mode: picks validated against mirror_props (existing behavior)
 * - Classic/sabotage/one_player/one_team: picks validated against submitted prop_ids
 * - Token verification works for both paths
 * - Card size enforcement for non-mirror modes
 * - Prop expiration checks for non-mirror modes
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Shared mock infrastructure
// ---------------------------------------------------------------------------

let tokenResult: { challengeId: string; email: string } | null = null;
let challengeRow: Record<string, unknown> | null = null;
let existingCards: unknown[] = [];
let mirrorPropsRows: unknown[] = [];
let propsRows: unknown[] = [];
let insertedCard: Record<string, unknown> | null = null;
let insertedPicks: unknown[] = [];
let allLockedCards: unknown[] = [];

const mockMarkTokenUsed = vi.fn();

vi.mock("@/lib/challenges/guest-token", () => ({
  verifyGuestToken: vi.fn(async () => tokenResult),
  markTokenUsed: (...args: unknown[]) => mockMarkTokenUsed(...args),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

// Build a chainable Supabase mock that routes by table + method
function createMockAdmin() {
  const updates: Array<{ table: string; data: unknown }> = [];

  function createChain(table: string) {
    let filterState = "";

    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop) {
        if (prop === "then") {
          let result: { data: unknown; error: unknown };

          if (table === "challenges") {
            result = { data: challengeRow, error: null };
          } else if (table === "cards" && filterState === "existing_check") {
            result = { data: existingCards, error: null };
          } else if (table === "cards" && filterState === "locked_check") {
            result = { data: allLockedCards, error: null };
          } else if (table === "cards" && filterState === "insert") {
            result = { data: insertedCard, error: insertedCard ? null : { message: "insert failed" } };
          } else if (table === "picks") {
            result = { data: insertedPicks, error: null };
          } else if (table === "props") {
            result = {
              data: filterState === "mirror" ? mirrorPropsRows : propsRows,
              error: null,
            };
          } else {
            result = { data: null, error: null };
          }

          return (resolve: (v: unknown) => void) => resolve(result);
        }
        if (prop === "catch" || prop === "finally") return undefined;

        return (...args: unknown[]) => {
          if (prop === "select") return new Proxy({}, handler);
          if (prop === "eq") {
            if (args[0] === "status") filterState = "locked_check";
            return new Proxy({}, handler);
          }
          if (prop === "is") {
            filterState = "existing_check";
            return new Proxy({}, handler);
          }
          if (prop === "in") {
            if (table === "props" && challengeRow &&
                (challengeRow as Record<string, unknown>).mirror_props) {
              filterState = "mirror";
            }
            return new Proxy({}, handler);
          }
          if (prop === "limit") return new Proxy({}, handler);
          if (prop === "single") return new Proxy({}, handler);
          if (prop === "insert") {
            if (table === "cards") {
              filterState = "insert";
              insertedCard = {
                id: "card-001",
                ...(args[0] as Record<string, unknown>),
              };
            }
            if (table === "picks") {
              insertedPicks = (args[0] as unknown[]).map((p, i) => ({
                id: `pick-${i}`,
                ...(p as Record<string, unknown>),
              }));
            }
            return new Proxy({}, handler);
          }
          if (prop === "update") {
            updates.push({ table, data: args[0] });
            return new Proxy({}, handler);
          }
          return new Proxy({}, handler);
        };
      },
    };

    return new Proxy({}, handler);
  }

  return {
    admin: { from: (table: string) => createChain(table) },
    updates,
  };
}

let mockAdminInstance: ReturnType<typeof createMockAdmin>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdminInstance.admin,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const futureTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const pastTime = new Date(Date.now() - 60 * 1000).toISOString();

function makeChallenge(overrides: Record<string, unknown> = {}) {
  return {
    id: "ch-001",
    challenger_id: "user-a",
    opponent_id: null,
    status: "pending",
    game_mode: "classic",
    card_size: 3,
    mirror_props: null,
    ...overrides,
  };
}

async function callGuestPick(challengeId: string, body: unknown) {
  // Dynamic import to get fresh module with mocks applied
  const mod = await import("@/app/api/challenges/[id]/guest-pick/route");
  const request = new Request("http://localhost/api/challenges/ch-001/guest-pick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await mod.POST(
    request as any,
    { params: Promise.resolve({ id: challengeId }) }
  );
  return {
    status: response.status,
    body: await response.json(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockAdminInstance = createMockAdmin();
  tokenResult = { challengeId: "ch-001", email: "guest@example.com" };
  challengeRow = makeChallenge();
  existingCards = [];
  mirrorPropsRows = [];
  propsRows = [];
  insertedCard = null;
  insertedPicks = [];
  allLockedCards = [];
  mockMarkTokenUsed.mockResolvedValue(true);
});

describe("guest-pick: classic mode (no mirror_props)", () => {
  it("accepts valid picks for a classic challenge", async () => {
    propsRows = [
      { id: "p1", games: { commence_time: futureTime } },
      { id: "p2", games: { commence_time: futureTime } },
      { id: "p3", games: { commence_time: futureTime } },
    ];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "p1", selection: "over" },
        { prop_id: "p2", selection: "under" },
        { prop_id: "p3", selection: "over" },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.card).toBeDefined();
    expect(res.body.card.id).toBe("card-001");
    expect(mockMarkTokenUsed).toHaveBeenCalledWith("valid-token");
  });

  it("rejects picks with expired props", async () => {
    propsRows = [
      { id: "p1", games: { commence_time: futureTime } },
      { id: "p2", games: { commence_time: pastTime } },
    ];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "p1", selection: "over" },
        { prop_id: "p2", selection: "under" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already started");
  });

  it("rejects if picks exceed card_size", async () => {
    challengeRow = makeChallenge({ card_size: 2 });
    propsRows = [
      { id: "p1", games: { commence_time: futureTime } },
      { id: "p2", games: { commence_time: futureTime } },
      { id: "p3", games: { commence_time: futureTime } },
    ];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "p1", selection: "over" },
        { prop_id: "p2", selection: "under" },
        { prop_id: "p3", selection: "over" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("picks");
  });

  it("rejects fewer than 2 picks", async () => {
    propsRows = [{ id: "p1", games: { commence_time: futureTime } }];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [{ prop_id: "p1", selection: "over" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("picks");
  });

  it("rejects if a prop doesn't exist", async () => {
    // Only 1 of 2 props found
    propsRows = [{ id: "p1", games: { commence_time: futureTime } }];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "p1", selection: "over" },
        { prop_id: "p999", selection: "under" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not found");
  });
});

describe("guest-pick: mirror mode (with mirror_props)", () => {
  beforeEach(() => {
    challengeRow = makeChallenge({
      game_mode: "mirror",
      mirror_props: ["mp1", "mp2"],
      card_size: 2,
    });
  });

  it("accepts valid picks against mirror props", async () => {
    mirrorPropsRows = [
      { id: "mp1", games: { commence_time: futureTime } },
      { id: "mp2", games: { commence_time: futureTime } },
    ];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "mp1", selection: "over" },
        { prop_id: "mp2", selection: "under" },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.card).toBeDefined();
  });

  it("rejects picks for non-mirror props", async () => {
    mirrorPropsRows = [
      { id: "mp1", games: { commence_time: futureTime } },
      { id: "mp2", games: { commence_time: futureTime } },
    ];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "mp1", selection: "over" },
        { prop_id: "other-prop", selection: "under" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("not a valid pickable prop");
  });

  it("rejects if not all mirror props are picked", async () => {
    mirrorPropsRows = [
      { id: "mp1", games: { commence_time: futureTime } },
      { id: "mp2", games: { commence_time: futureTime } },
    ];

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [{ prop_id: "mp1", selection: "over" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("2 picks are required");
  });
});

describe("guest-pick: shared validations", () => {
  it("rejects invalid token", async () => {
    tokenResult = null;

    const res = await callGuestPick("ch-001", {
      token: "bad-token",
      picks: [{ prop_id: "p1", selection: "over" }],
    });

    expect(res.status).toBe(401);
  });

  it("rejects token for different challenge", async () => {
    tokenResult = { challengeId: "ch-other", email: "guest@example.com" };

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [{ prop_id: "p1", selection: "over" }],
    });

    expect(res.status).toBe(401);
  });

  it("rejects if challenge already has opponent", async () => {
    challengeRow = makeChallenge({ opponent_id: "user-b" });

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [{ prop_id: "p1", selection: "over" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("already has an opponent");
  });

  it("rejects duplicate prop_ids", async () => {
    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [
        { prop_id: "p1", selection: "over" },
        { prop_id: "p1", selection: "under" },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("Duplicate");
  });

  it("rejects cancelled challenge", async () => {
    challengeRow = makeChallenge({ status: "cancelled" });

    const res = await callGuestPick("ch-001", {
      token: "valid-token",
      picks: [{ prop_id: "p1", selection: "over" }],
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("cancelled");
  });
});
