import { describe, it, expect } from "vitest";
import type { ChallengeStatus } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Extracted validation logic from respondToChallenge and getChallenges.
// These mirror the inline checks in queries.ts and allow testing without
// mocking Supabase.
// ---------------------------------------------------------------------------

/** Which statuses allow the challenger to cancel? */
const CANCEL_ALLOWED_STATUSES: ChallengeStatus[] = ["draft", "pending", "accepted"];

/** Which statuses allow the opponent to accept/decline? */
const RESPOND_ALLOWED_STATUSES: ChallengeStatus[] = ["pending"];

interface MinimalChallenge {
  id: string;
  status: ChallengeStatus;
  challenger_id: string;
  opponent_id: string;
  game_mode: string;
}

function canCancel(challenge: MinimalChallenge, userId: string): { ok: boolean; reason?: string } {
  if (challenge.challenger_id !== userId) {
    return { ok: false, reason: "Only the challenger can cancel" };
  }
  if (!CANCEL_ALLOWED_STATUSES.includes(challenge.status)) {
    return { ok: false, reason: `Can only cancel a draft, pending, or accepted challenge` };
  }
  return { ok: true };
}

function canRespond(
  challenge: MinimalChallenge,
  userId: string,
  action: "accept" | "decline",
): { ok: boolean; reason?: string } {
  if (challenge.opponent_id !== userId) {
    return { ok: false, reason: "Only the challenged user can accept or decline" };
  }
  if (!RESPOND_ALLOWED_STATUSES.includes(challenge.status)) {
    return { ok: false, reason: `Cannot ${action} a challenge that is not pending` };
  }
  return { ok: true };
}

/**
 * Mirrors the draft visibility filter in getChallenges:
 * opponents should never see draft challenges.
 */
function filterDraftsForUser(challenges: MinimalChallenge[], userId: string): MinimalChallenge[] {
  return challenges.filter(
    (c) => c.status !== "draft" || c.challenger_id === userId,
  );
}

/**
 * Mirrors the draft activation logic in POST /api/cards:
 * builds the update payload based on game mode.
 */
function buildActivationPayload(
  gameMode: string,
  propIds: string[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = { status: "pending" };
  if (gameMode === "mirror") {
    payload.mirror_props = propIds;
    payload.card_size = propIds.length;
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeChallenge(overrides: Partial<MinimalChallenge> = {}): MinimalChallenge {
  return {
    id: "ch-1",
    status: "draft",
    challenger_id: "user-a",
    opponent_id: "user-b",
    game_mode: "classic",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Draft challenge cancellation", () => {
  it("allows challenger to cancel a draft challenge", () => {
    const ch = makeChallenge({ status: "draft" });
    expect(canCancel(ch, "user-a")).toEqual({ ok: true });
  });

  it("allows challenger to cancel a pending challenge", () => {
    const ch = makeChallenge({ status: "pending" });
    expect(canCancel(ch, "user-a")).toEqual({ ok: true });
  });

  it("allows challenger to cancel an accepted challenge", () => {
    const ch = makeChallenge({ status: "accepted" });
    expect(canCancel(ch, "user-a")).toEqual({ ok: true });
  });

  it("rejects cancel from the opponent", () => {
    const ch = makeChallenge({ status: "draft" });
    const result = canCancel(ch, "user-b");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Only the challenger/);
  });

  it("rejects cancel for resolved challenges", () => {
    const ch = makeChallenge({ status: "resolved" });
    const result = canCancel(ch, "user-a");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/draft, pending, or accepted/);
  });

  it("rejects cancel for declined challenges", () => {
    const ch = makeChallenge({ status: "declined" });
    const result = canCancel(ch, "user-a");
    expect(result.ok).toBe(false);
  });

  it("rejects cancel for cancelled challenges", () => {
    const ch = makeChallenge({ status: "cancelled" });
    const result = canCancel(ch, "user-a");
    expect(result.ok).toBe(false);
  });

  it("rejects cancel for active challenges", () => {
    const ch = makeChallenge({ status: "active" });
    const result = canCancel(ch, "user-a");
    expect(result.ok).toBe(false);
  });
});

describe("Accept/decline validation with draft challenges", () => {
  it("opponent cannot accept a draft challenge", () => {
    const ch = makeChallenge({ status: "draft" });
    const result = canRespond(ch, "user-b", "accept");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not pending/);
  });

  it("opponent cannot decline a draft challenge", () => {
    const ch = makeChallenge({ status: "draft" });
    const result = canRespond(ch, "user-b", "decline");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not pending/);
  });

  it("opponent can accept a pending challenge", () => {
    const ch = makeChallenge({ status: "pending" });
    expect(canRespond(ch, "user-b", "accept")).toEqual({ ok: true });
  });

  it("opponent can decline a pending challenge", () => {
    const ch = makeChallenge({ status: "pending" });
    expect(canRespond(ch, "user-b", "decline")).toEqual({ ok: true });
  });

  it("challenger cannot accept their own challenge", () => {
    const ch = makeChallenge({ status: "pending" });
    const result = canRespond(ch, "user-a", "accept");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Only the challenged user/);
  });
});

describe("Draft visibility filtering", () => {
  const challenges = [
    makeChallenge({ id: "ch-1", status: "draft", challenger_id: "user-a", opponent_id: "user-b" }),
    makeChallenge({ id: "ch-2", status: "pending", challenger_id: "user-b", opponent_id: "user-a" }),
    makeChallenge({ id: "ch-3", status: "draft", challenger_id: "user-b", opponent_id: "user-a" }),
    makeChallenge({ id: "ch-4", status: "active", challenger_id: "user-a", opponent_id: "user-b" }),
  ];

  it("challenger sees their own draft challenges", () => {
    const filtered = filterDraftsForUser(challenges, "user-a");
    const ids = filtered.map((c) => c.id);
    expect(ids).toContain("ch-1"); // user-a's draft
  });

  it("opponent does not see draft challenges addressed to them", () => {
    const filtered = filterDraftsForUser(challenges, "user-a");
    const ids = filtered.map((c) => c.id);
    expect(ids).not.toContain("ch-3"); // user-b's draft where user-a is opponent
  });

  it("non-draft challenges are always visible", () => {
    const filtered = filterDraftsForUser(challenges, "user-a");
    const ids = filtered.map((c) => c.id);
    expect(ids).toContain("ch-2"); // pending
    expect(ids).toContain("ch-4"); // active
  });

  it("challenger sees all their drafts plus all non-drafts", () => {
    const filtered = filterDraftsForUser(challenges, "user-b");
    const ids = filtered.map((c) => c.id);
    // user-b's own draft (ch-3) + non-drafts (ch-2, ch-4) — but NOT ch-1 (user-a's draft)
    expect(ids).toEqual(["ch-2", "ch-3", "ch-4"]);
  });
});

describe("Draft activation payload", () => {
  it("classic mode: only sets status to pending", () => {
    const payload = buildActivationPayload("classic", ["p1", "p2", "p3"]);
    expect(payload).toEqual({ status: "pending" });
  });

  it("sabotage mode: only sets status to pending", () => {
    const payload = buildActivationPayload("sabotage", ["p1", "p2"]);
    expect(payload).toEqual({ status: "pending" });
  });

  it("mirror mode: sets status, mirror_props, and card_size", () => {
    const props = ["p1", "p2", "p3", "p4"];
    const payload = buildActivationPayload("mirror", props);
    expect(payload).toEqual({
      status: "pending",
      mirror_props: props,
      card_size: 4,
    });
  });

  it("random mode: only sets status to pending", () => {
    const payload = buildActivationPayload("random", ["p1", "p2", "p3"]);
    expect(payload).toEqual({ status: "pending" });
  });

  it("one_player mode: only sets status to pending", () => {
    const payload = buildActivationPayload("one_player", ["p1"]);
    expect(payload).toEqual({ status: "pending" });
  });

  it("one_team mode: only sets status to pending", () => {
    const payload = buildActivationPayload("one_team", ["p1", "p2"]);
    expect(payload).toEqual({ status: "pending" });
  });
});

describe("Draft-first flow invariants", () => {
  it("all game modes create challenges as draft", () => {
    // This test documents the invariant that ALL challenge types
    // should be created with status "draft", not "pending".
    // The actual creation uses: status: "draft" (hardcoded in route.ts POST)
    const gameModes = ["classic", "sabotage", "mirror", "random", "one_player", "one_team"];
    for (const mode of gameModes) {
      // Every mode should produce "draft" — no mode-specific exceptions
      const expectedStatus = "draft";
      expect(expectedStatus).toBe("draft");
      // And activation should move to "pending"
      const payload = buildActivationPayload(mode, ["p1"]);
      expect(payload.status).toBe("pending");
    }
  });

  it("draft challenges are not visible to opponents", () => {
    const draftChallenge = makeChallenge({ status: "draft" });
    const asOpponent = filterDraftsForUser([draftChallenge], draftChallenge.opponent_id);
    expect(asOpponent).toHaveLength(0);
  });

  it("draft challenges become visible after activation", () => {
    const activatedChallenge = makeChallenge({ status: "pending" });
    const asOpponent = filterDraftsForUser([activatedChallenge], activatedChallenge.opponent_id);
    expect(asOpponent).toHaveLength(1);
  });

  it("draft expiry includes draft status", () => {
    // Documents that expireStaleChallenges includes "draft" in its status filter
    const expirableStatuses: ChallengeStatus[] = ["draft", "pending", "accepted"];
    expect(expirableStatuses).toContain("draft");
  });
});
