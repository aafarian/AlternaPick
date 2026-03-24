import { describe, it, expect } from "vitest";
import type { ChallengeStatus } from "@/lib/supabase/types";
import { UNPICKABLE_CHALLENGE_STATUSES, LOCK_BUFFER_MS } from "../constants";

// ---------------------------------------------------------------------------
// Constants (mirrors planned values from constants.ts — Task 5.2)
// ---------------------------------------------------------------------------

const MAX_LOBBY_SIZE = 8;
const MIN_LOBBY_SIZE = 2;

// ---------------------------------------------------------------------------
// Types (mirrors planned types from queries.ts — Task 5.2)
// ---------------------------------------------------------------------------

type LobbyType = "1v1" | "group";
type ParticipantStatus = "invited" | "accepted" | "declined" | "active";

interface GroupOpponent {
  user_id?: string;
  email?: string;
}

interface MinimalGroupChallenge {
  id: string;
  status: ChallengeStatus;
  challenger_id: string;
  lobby_type: LobbyType;
  max_participants: number;
}

interface Participant {
  id: string;
  challenge_id: string;
  user_id: string | null;
  email: string | null;
  status: ParticipantStatus;
  card_id: string | null;
  placement: number | null;
  score: number | null;
  is_creator: boolean;
}

// ---------------------------------------------------------------------------
// Extracted validation logic (mirrors planned functions in queries.ts)
// ---------------------------------------------------------------------------

/**
 * Validates the opponents list for a group challenge creation.
 * Mirrors the validation in createGroupChallenge (Task 5.3).
 */
function validateGroupOpponents(
  challengerId: string,
  opponents: GroupOpponent[],
): { ok: boolean; reason?: string } {
  // Must have at least 1 opponent (MIN_LOBBY_SIZE - 1 for creator)
  if (opponents.length < MIN_LOBBY_SIZE - 1) {
    return { ok: false, reason: "At least 1 opponent is required" };
  }

  // Max 7 opponents (MAX_LOBBY_SIZE - 1 for creator)
  if (opponents.length > MAX_LOBBY_SIZE - 1) {
    return { ok: false, reason: `Cannot have more than ${MAX_LOBBY_SIZE - 1} opponents` };
  }

  // Each opponent must have either user_id or email
  for (const opp of opponents) {
    if (!opp.user_id && !opp.email) {
      return { ok: false, reason: "Each opponent must have a user_id or email" };
    }
  }

  // No self-challenge
  if (opponents.some((o) => o.user_id === challengerId)) {
    return { ok: false, reason: "Cannot challenge yourself" };
  }

  // No duplicate opponents (by user_id or email)
  const userIds = opponents.filter((o) => o.user_id).map((o) => o.user_id);
  const emails = opponents.filter((o) => o.email).map((o) => o.email);

  if (new Set(userIds).size !== userIds.length) {
    return { ok: false, reason: "Duplicate opponent user_id" };
  }
  if (new Set(emails).size !== emails.length) {
    return { ok: false, reason: "Duplicate opponent email" };
  }

  return { ok: true };
}

/**
 * Determines the lobby_type based on the number of opponents.
 */
function determineLobbyType(opponentCount: number): LobbyType {
  return opponentCount >= 2 ? "group" : "1v1";
}

/**
 * Creates the expected participant rows for a group challenge.
 * The creator is always the first participant with is_creator=true.
 */
function buildParticipantRows(
  challengeId: string,
  challengerId: string,
  opponents: GroupOpponent[],
): Array<{
  challenge_id: string;
  user_id: string | null;
  email: string | null;
  status: ParticipantStatus;
  is_creator: boolean;
}> {
  const rows: Array<{
    challenge_id: string;
    user_id: string | null;
    email: string | null;
    status: ParticipantStatus;
    is_creator: boolean;
  }> = [];

  // Creator row
  rows.push({
    challenge_id: challengeId,
    user_id: challengerId,
    email: null,
    status: "active",
    is_creator: true,
  });

  // Opponent rows
  for (const opp of opponents) {
    rows.push({
      challenge_id: challengeId,
      user_id: opp.user_id ?? null,
      email: opp.email ?? null,
      status: "invited",
      is_creator: false,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Participant status transition logic (mirrors Task 5.5)
// ---------------------------------------------------------------------------

/**
 * Determines whether a participant status transition is valid.
 */
function canTransition(
  current: ParticipantStatus,
  next: ParticipantStatus,
): boolean {
  const validTransitions: Record<ParticipantStatus, ParticipantStatus[]> = {
    invited: ["accepted", "declined"],
    accepted: ["active"],
    declined: [],
    active: [],
  };
  return validTransitions[current].includes(next);
}

/**
 * Checks whether all non-declined participants are active,
 * meaning the challenge can transition to "active".
 */
function allParticipantsActive(participants: Participant[]): boolean {
  const nonDeclined = participants.filter((p) => p.status !== "declined");
  return nonDeclined.length >= MIN_LOBBY_SIZE && nonDeclined.every((p) => p.status === "active");
}

/**
 * Checks whether a group challenge should be cancelled due to
 * too few remaining participants after a decline.
 */
function shouldCancelAfterDecline(participants: Participant[]): boolean {
  const remaining = participants.filter((p) => p.status !== "declined");
  return remaining.length < MIN_LOBBY_SIZE;
}

// ---------------------------------------------------------------------------
// Resolution logic (mirrors Task 5.10)
// ---------------------------------------------------------------------------

interface ScoredParticipant {
  participant_id: string;
  user_id: string | null;
  score: number;
}

/**
 * Assigns placements using dense ranking (ties get same placement).
 * Returns participants with placement assigned.
 */
function assignPlacements(
  participants: ScoredParticipant[],
): Array<ScoredParticipant & { placement: number }> {
  // Sort by score descending
  const sorted = [...participants].sort((a, b) => b.score - a.score);

  let currentPlacement = 1;
  return sorted.map((p, i) => {
    if (i > 0 && sorted[i - 1].score !== p.score) {
      currentPlacement = i + 1;
    }
    return { ...p, placement: currentPlacement };
  });
}

/**
 * Determines the winner_id for a group challenge.
 * Returns null if 1st place is a tie.
 */
function determineGroupWinner(
  placed: Array<ScoredParticipant & { placement: number }>,
): string | null {
  const firstPlace = placed.filter((p) => p.placement === 1);
  if (firstPlace.length !== 1) return null;
  return firstPlace[0].user_id;
}

/**
 * Returns the ordinal suffix for a placement number.
 */
function getOrdinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;

  const mod10 = n % 10;
  if (mod10 === 1) return `${n}st`;
  if (mod10 === 2) return `${n}nd`;
  if (mod10 === 3) return `${n}rd`;
  return `${n}th`;
}

// ---------------------------------------------------------------------------
// Expiration logic (mirrors Task 5.11)
// ---------------------------------------------------------------------------

/**
 * Determines if a group challenge should expire based on 24h timeout.
 */
function isGroupChallengeExpired(createdAt: string): boolean {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return new Date(createdAt).getTime() < cutoff;
}

/**
 * After individual participant expiration (auto-decline), determines
 * whether the group challenge should be cancelled entirely.
 */
function shouldCancelGroupAfterExpiration(participants: Participant[]): boolean {
  const active = participants.filter(
    (p) => p.status !== "declined",
  );
  return active.length < MIN_LOBBY_SIZE;
}

// ---------------------------------------------------------------------------
// Pick privacy logic (mirrors Task 5.8/5.9)
// ---------------------------------------------------------------------------

/**
 * Determines whether the requesting user can see other participants' picks.
 * Picks are hidden until the requesting user has locked their own card.
 */
function canSeePicks(
  requestingUserId: string,
  participants: Participant[],
): boolean {
  const self = participants.find((p) => p.user_id === requestingUserId);
  if (!self) return false;
  return self.status === "active" && self.card_id !== null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let participantCounter = 0;

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  participantCounter++;
  return {
    id: `part-${participantCounter}`,
    challenge_id: "ch-group-1",
    user_id: `user-${participantCounter}`,
    email: null,
    status: "invited",
    card_id: null,
    placement: null,
    score: null,
    is_creator: false,
    ...overrides,
  };
}

function makeGroupChallenge(
  overrides: Partial<MinimalGroupChallenge> = {},
): MinimalGroupChallenge {
  return {
    id: "ch-group-1",
    status: "draft",
    challenger_id: "user-creator",
    lobby_type: "group",
    max_participants: 8,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Group challenge creation validation", () => {
  describe("opponent count bounds", () => {
    it("accepts 2 opponents (3 total participants)", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      expect(result).toEqual({ ok: true });
    });

    it("accepts 7 opponents (max lobby size of 8)", () => {
      const opponents = Array.from({ length: 7 }, (_, i) => ({
        user_id: `user-${i + 1}`,
      }));
      const result = validateGroupOpponents("user-creator", opponents);
      expect(result).toEqual({ ok: true });
    });

    it("rejects more than 7 opponents", () => {
      const opponents = Array.from({ length: 8 }, (_, i) => ({
        user_id: `user-${i + 1}`,
      }));
      const result = validateGroupOpponents("user-creator", opponents);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Cannot have more than 7/);
    });

    it("accepts 1 opponent (minimum for a challenge)", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-1" },
      ]);
      expect(result).toEqual({ ok: true });
    });

    it("rejects empty opponents array", () => {
      const result = validateGroupOpponents("user-creator", []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/At least 1 opponent/);
    });
  });

  describe("self-challenge prevention", () => {
    it("rejects self-challenge by user_id", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-creator" },
        { user_id: "user-2" },
      ]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Cannot challenge yourself/);
    });

    it("allows email opponent even with same underlying user", () => {
      // Email opponents are resolved later — validation only checks user_id
      const result = validateGroupOpponents("user-creator", [
        { email: "creator@example.com" },
        { user_id: "user-2" },
      ]);
      expect(result).toEqual({ ok: true });
    });
  });

  describe("duplicate prevention", () => {
    it("rejects duplicate user_id opponents", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-1" },
        { user_id: "user-1" },
        { user_id: "user-2" },
      ]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Duplicate opponent user_id/);
    });

    it("rejects duplicate email opponents", () => {
      const result = validateGroupOpponents("user-creator", [
        { email: "a@example.com" },
        { email: "a@example.com" },
      ]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Duplicate opponent email/);
    });

    it("allows same user_id and email for different opponents", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-1" },
        { email: "user1@example.com" },
      ]);
      expect(result).toEqual({ ok: true });
    });
  });

  describe("opponent identification", () => {
    it("rejects opponent with neither user_id nor email", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-1" },
        {},
      ]);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/must have a user_id or email/);
    });

    it("accepts mixed friends and email opponents", () => {
      const result = validateGroupOpponents("user-creator", [
        { user_id: "user-1" },
        { email: "guest@example.com" },
        { user_id: "user-3" },
        { email: "guest2@example.com" },
      ]);
      expect(result).toEqual({ ok: true });
    });
  });
});

describe("Lobby type determination", () => {
  it("returns '1v1' for single opponent", () => {
    expect(determineLobbyType(1)).toBe("1v1");
  });

  it("returns 'group' for 2 opponents", () => {
    expect(determineLobbyType(2)).toBe("group");
  });

  it("returns 'group' for 7 opponents", () => {
    expect(determineLobbyType(7)).toBe("group");
  });
});

describe("Participant row creation", () => {
  it("creates creator row as first participant with active status", () => {
    const rows = buildParticipantRows("ch-1", "user-creator", [
      { user_id: "user-1" },
    ]);
    expect(rows[0]).toEqual({
      challenge_id: "ch-1",
      user_id: "user-creator",
      email: null,
      status: "active",
      is_creator: true,
    });
  });

  it("creates opponent rows with invited status", () => {
    const rows = buildParticipantRows("ch-1", "user-creator", [
      { user_id: "user-1" },
      { email: "guest@example.com" },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual({
      challenge_id: "ch-1",
      user_id: "user-1",
      email: null,
      status: "invited",
      is_creator: false,
    });
    expect(rows[2]).toEqual({
      challenge_id: "ch-1",
      user_id: null,
      email: "guest@example.com",
      status: "invited",
      is_creator: false,
    });
  });

  it("creates correct number of rows for max lobby", () => {
    const opponents = Array.from({ length: 7 }, (_, i) => ({
      user_id: `user-${i + 1}`,
    }));
    const rows = buildParticipantRows("ch-1", "user-creator", opponents);
    expect(rows).toHaveLength(8);
    expect(rows.filter((r) => r.is_creator)).toHaveLength(1);
    expect(rows.filter((r) => !r.is_creator)).toHaveLength(7);
  });
});

describe("Participant status transitions", () => {
  describe("valid transitions", () => {
    it("invited -> accepted", () => {
      expect(canTransition("invited", "accepted")).toBe(true);
    });

    it("invited -> declined", () => {
      expect(canTransition("invited", "declined")).toBe(true);
    });

    it("accepted -> active", () => {
      expect(canTransition("accepted", "active")).toBe(true);
    });
  });

  describe("invalid transitions", () => {
    it("declined -> any status", () => {
      expect(canTransition("declined", "invited")).toBe(false);
      expect(canTransition("declined", "accepted")).toBe(false);
      expect(canTransition("declined", "active")).toBe(false);
    });

    it("active -> any status", () => {
      expect(canTransition("active", "invited")).toBe(false);
      expect(canTransition("active", "accepted")).toBe(false);
      expect(canTransition("active", "declined")).toBe(false);
    });

    it("invited -> active (must go through accepted first)", () => {
      expect(canTransition("invited", "active")).toBe(false);
    });

    it("accepted -> declined (once accepted, cannot decline)", () => {
      expect(canTransition("accepted", "declined")).toBe(false);
    });
  });
});

describe("Challenge activation (all participants active)", () => {
  it("activates when all non-declined participants are active", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "active", user_id: "user-1" }),
      makeParticipant({ status: "active", user_id: "user-2" }),
      makeParticipant({ status: "declined", user_id: "user-3" }),
    ];
    expect(allParticipantsActive(participants)).toBe(true);
  });

  it("does not activate while any participant is still invited", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "active", user_id: "user-1" }),
      makeParticipant({ status: "invited", user_id: "user-2" }),
    ];
    expect(allParticipantsActive(participants)).toBe(false);
  });

  it("does not activate while any participant is still accepted (not locked)", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "accepted", user_id: "user-1" }),
    ];
    expect(allParticipantsActive(participants)).toBe(false);
  });

  it("does not activate with fewer than MIN_LOBBY_SIZE non-declined", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "declined", user_id: "user-1" }),
      makeParticipant({ status: "declined", user_id: "user-2" }),
    ];
    expect(allParticipantsActive(participants)).toBe(false);
  });
});

describe("Challenge cancellation after decline", () => {
  it("cancels when fewer than 2 participants remain", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "declined", user_id: "user-1" }),
      makeParticipant({ status: "declined", user_id: "user-2" }),
    ];
    expect(shouldCancelAfterDecline(participants)).toBe(true);
  });

  it("does not cancel when 2 or more remain", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "active", user_id: "user-1" }),
      makeParticipant({ status: "declined", user_id: "user-2" }),
    ];
    expect(shouldCancelAfterDecline(participants)).toBe(false);
  });
});

describe("Resolution with placement scoring", () => {
  describe("placement assignment (dense ranking)", () => {
    it("assigns sequential placements for unique scores", () => {
      const scored: ScoredParticipant[] = [
        { participant_id: "p1", user_id: "user-1", score: 5 },
        { participant_id: "p2", user_id: "user-2", score: 3 },
        { participant_id: "p3", user_id: "user-3", score: 1 },
      ];
      const placed = assignPlacements(scored);
      expect(placed).toEqual([
        { participant_id: "p1", user_id: "user-1", score: 5, placement: 1 },
        { participant_id: "p2", user_id: "user-2", score: 3, placement: 2 },
        { participant_id: "p3", user_id: "user-3", score: 1, placement: 3 },
      ]);
    });

    it("assigns same placement for tied scores (standard competition ranking)", () => {
      const scored: ScoredParticipant[] = [
        { participant_id: "p1", user_id: "user-1", score: 5 },
        { participant_id: "p2", user_id: "user-2", score: 5 },
        { participant_id: "p3", user_id: "user-3", score: 3 },
      ];
      const placed = assignPlacements(scored);
      expect(placed[0].placement).toBe(1);
      expect(placed[1].placement).toBe(1);
      // 3rd person gets placement 3 (not 2) — standard competition ranking
      expect(placed[2].placement).toBe(3);
    });

    it("handles all participants tied", () => {
      const scored: ScoredParticipant[] = [
        { participant_id: "p1", user_id: "user-1", score: 4 },
        { participant_id: "p2", user_id: "user-2", score: 4 },
        { participant_id: "p3", user_id: "user-3", score: 4 },
      ];
      const placed = assignPlacements(scored);
      expect(placed.every((p) => p.placement === 1)).toBe(true);
    });

    it("handles tie in the middle", () => {
      const scored: ScoredParticipant[] = [
        { participant_id: "p1", user_id: "user-1", score: 6 },
        { participant_id: "p2", user_id: "user-2", score: 4 },
        { participant_id: "p3", user_id: "user-3", score: 4 },
        { participant_id: "p4", user_id: "user-4", score: 2 },
      ];
      const placed = assignPlacements(scored);
      expect(placed.map((p) => p.placement)).toEqual([1, 2, 2, 4]);
    });

    it("handles large group with multiple ties", () => {
      const scored: ScoredParticipant[] = [
        { participant_id: "p1", user_id: "user-1", score: 6 },
        { participant_id: "p2", user_id: "user-2", score: 6 },
        { participant_id: "p3", user_id: "user-3", score: 4 },
        { participant_id: "p4", user_id: "user-4", score: 4 },
        { participant_id: "p5", user_id: "user-5", score: 2 },
        { participant_id: "p6", user_id: "user-6", score: 2 },
        { participant_id: "p7", user_id: "user-7", score: 1 },
        { participant_id: "p8", user_id: "user-8", score: 0 },
      ];
      const placed = assignPlacements(scored);
      expect(placed.map((p) => p.placement)).toEqual([1, 1, 3, 3, 5, 5, 7, 8]);
    });

    it("handles 2-participant group (minimum)", () => {
      const scored: ScoredParticipant[] = [
        { participant_id: "p1", user_id: "user-1", score: 3 },
        { participant_id: "p2", user_id: "user-2", score: 1 },
      ];
      const placed = assignPlacements(scored);
      expect(placed.map((p) => p.placement)).toEqual([1, 2]);
    });
  });

  describe("winner determination", () => {
    it("returns user_id of sole 1st place finisher", () => {
      const placed = [
        { participant_id: "p1", user_id: "user-1", score: 5, placement: 1 },
        { participant_id: "p2", user_id: "user-2", score: 3, placement: 2 },
        { participant_id: "p3", user_id: "user-3", score: 1, placement: 3 },
      ];
      expect(determineGroupWinner(placed)).toBe("user-1");
    });

    it("returns null when 1st place is tied", () => {
      const placed = [
        { participant_id: "p1", user_id: "user-1", score: 5, placement: 1 },
        { participant_id: "p2", user_id: "user-2", score: 5, placement: 1 },
        { participant_id: "p3", user_id: "user-3", score: 3, placement: 3 },
      ];
      expect(determineGroupWinner(placed)).toBeNull();
    });

    it("returns null when all participants tie", () => {
      const placed = [
        { participant_id: "p1", user_id: "user-1", score: 4, placement: 1 },
        { participant_id: "p2", user_id: "user-2", score: 4, placement: 1 },
        { participant_id: "p3", user_id: "user-3", score: 4, placement: 1 },
      ];
      expect(determineGroupWinner(placed)).toBeNull();
    });
  });
});

describe("Ordinal suffix helper", () => {
  it("handles 1st through 8th", () => {
    expect(getOrdinalSuffix(1)).toBe("1st");
    expect(getOrdinalSuffix(2)).toBe("2nd");
    expect(getOrdinalSuffix(3)).toBe("3rd");
    expect(getOrdinalSuffix(4)).toBe("4th");
    expect(getOrdinalSuffix(5)).toBe("5th");
    expect(getOrdinalSuffix(6)).toBe("6th");
    expect(getOrdinalSuffix(7)).toBe("7th");
    expect(getOrdinalSuffix(8)).toBe("8th");
  });

  it("handles teens (11th, 12th, 13th)", () => {
    expect(getOrdinalSuffix(11)).toBe("11th");
    expect(getOrdinalSuffix(12)).toBe("12th");
    expect(getOrdinalSuffix(13)).toBe("13th");
  });

  it("handles 21st, 22nd, 23rd", () => {
    expect(getOrdinalSuffix(21)).toBe("21st");
    expect(getOrdinalSuffix(22)).toBe("22nd");
    expect(getOrdinalSuffix(23)).toBe("23rd");
  });

  it("handles 111th, 112th, 113th (teen rule for hundreds)", () => {
    expect(getOrdinalSuffix(111)).toBe("111th");
    expect(getOrdinalSuffix(112)).toBe("112th");
    expect(getOrdinalSuffix(113)).toBe("113th");
  });
});

describe("Group challenge expiration", () => {
  it("expires challenges older than 24h", () => {
    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(isGroupChallengeExpired(oldDate)).toBe(true);
  });

  it("does not expire challenges younger than 24h", () => {
    const recentDate = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString();
    expect(isGroupChallengeExpired(recentDate)).toBe(false);
  });

  it("cancels group challenge when fewer than 2 remain after expiration", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "declined", user_id: "user-1" }),
      makeParticipant({ status: "declined", user_id: "user-2" }),
      makeParticipant({ status: "declined", user_id: "user-3" }),
    ];
    expect(shouldCancelGroupAfterExpiration(participants)).toBe(true);
  });

  it("does not cancel when enough participants remain", () => {
    const participants = [
      makeParticipant({ status: "active", is_creator: true, user_id: "user-creator" }),
      makeParticipant({ status: "active", user_id: "user-1" }),
      makeParticipant({ status: "declined", user_id: "user-2" }),
      makeParticipant({ status: "declined", user_id: "user-3" }),
    ];
    expect(shouldCancelGroupAfterExpiration(participants)).toBe(false);
  });
});

describe("Pick privacy", () => {
  it("hides picks when requesting user has not locked their card", () => {
    const participants = [
      makeParticipant({ status: "invited", user_id: "user-viewer", card_id: null }),
      makeParticipant({ status: "active", user_id: "user-1", card_id: "card-1" }),
    ];
    expect(canSeePicks("user-viewer", participants)).toBe(false);
  });

  it("shows picks when requesting user is active with a card", () => {
    const participants = [
      makeParticipant({ status: "active", user_id: "user-viewer", card_id: "card-viewer" }),
      makeParticipant({ status: "active", user_id: "user-1", card_id: "card-1" }),
    ];
    expect(canSeePicks("user-viewer", participants)).toBe(true);
  });

  it("hides picks for non-participant users", () => {
    const participants = [
      makeParticipant({ status: "active", user_id: "user-1", card_id: "card-1" }),
      makeParticipant({ status: "active", user_id: "user-2", card_id: "card-2" }),
    ];
    expect(canSeePicks("user-outsider", participants)).toBe(false);
  });

  it("hides picks when user is active but card_id is null (edge case)", () => {
    const participants = [
      makeParticipant({ status: "active", user_id: "user-viewer", card_id: null }),
      makeParticipant({ status: "active", user_id: "user-1", card_id: "card-1" }),
    ];
    expect(canSeePicks("user-viewer", participants)).toBe(false);
  });
});

describe("Cap enforcement (MAX_LOBBY_SIZE)", () => {
  it("MAX_LOBBY_SIZE is 8", () => {
    expect(MAX_LOBBY_SIZE).toBe(8);
  });

  it("MIN_LOBBY_SIZE is 2", () => {
    expect(MIN_LOBBY_SIZE).toBe(2);
  });

  it("max opponents is MAX_LOBBY_SIZE - 1 (creator takes one slot)", () => {
    const maxOpponents = MAX_LOBBY_SIZE - 1;
    expect(maxOpponents).toBe(7);

    // 7 opponents should pass
    const opponents = Array.from({ length: 7 }, (_, i) => ({
      user_id: `user-${i + 1}`,
    }));
    expect(validateGroupOpponents("user-creator", opponents).ok).toBe(true);

    // 8 opponents should fail
    opponents.push({ user_id: "user-8" });
    expect(validateGroupOpponents("user-creator", opponents).ok).toBe(false);
  });
});

describe("Backward compatibility: 1v1 invariants", () => {
  it("1v1 challenges have lobby_type '1v1' by default", () => {
    const challenge = makeGroupChallenge({ lobby_type: "1v1", max_participants: 2 });
    expect(challenge.lobby_type).toBe("1v1");
    expect(challenge.max_participants).toBe(2);
  });

  it("single opponent results in '1v1' lobby type", () => {
    expect(determineLobbyType(1)).toBe("1v1");
  });

  it("existing challenge statuses remain valid", () => {
    const statuses: ChallengeStatus[] = [
      "draft", "pending", "accepted", "declined", "active", "resolved", "cancelled",
    ];
    for (const status of statuses) {
      const ch = makeGroupChallenge({ status });
      expect(ch.status).toBe(status);
    }
  });

  it("UNPICKABLE_CHALLENGE_STATUSES still enforced", () => {
    expect(UNPICKABLE_CHALLENGE_STATUSES).toContain("cancelled");
    expect(UNPICKABLE_CHALLENGE_STATUSES).toContain("declined");
    expect(UNPICKABLE_CHALLENGE_STATUSES).toContain("resolved");
  });

  it("LOCK_BUFFER_MS is still 5 minutes", () => {
    expect(LOCK_BUFFER_MS).toBe(5 * 60 * 1000);
  });
});
