import { describe, it, expect, beforeEach } from "vitest";
import type { ChallengeStatus } from "@/lib/supabase/types";
import { MAX_LOBBY_SIZE, MIN_LOBBY_SIZE } from "../constants";

// ---------------------------------------------------------------------------
// Types mirroring the challenge system
// ---------------------------------------------------------------------------

type LobbyType = "1v1" | "group";
type ParticipantStatus = "invited" | "accepted" | "declined" | "active";

interface MinimalChallenge {
  id: string;
  status: ChallengeStatus;
  challenger_id: string;
  opponent_id: string | null;
  lobby_type: LobbyType;
  game_mode: string;
}

interface Participant {
  id: string;
  challenge_id: string;
  user_id: string | null;
  email: string | null;
  status: ParticipantStatus;
  card_id: string | null;
  is_creator: boolean;
}

interface Pick {
  id: string;
  card_id: string;
  games: { commence_time: string };
}

// ---------------------------------------------------------------------------
// Extracted validation logic (mirrors addParticipantToGroup / removeParticipantFromGroup)
// ---------------------------------------------------------------------------

/**
 * Validates whether a participant can be added to a challenge.
 * Mirrors the validation in addParticipantToGroup.
 */
function canAddParticipant(
  challenge: MinimalChallenge,
  inviterId: string,
  newUserId: string | null,
  newEmail: string | null,
  participants: Participant[],
): { ok: boolean; reason?: string } {
  // Cannot add to resolved or cancelled
  if (challenge.status === "resolved" || challenge.status === "cancelled") {
    return { ok: false, reason: `Cannot add participants to a ${challenge.status} challenge` };
  }

  // Verify inviter is a participant
  if (challenge.lobby_type !== "group") {
    if (inviterId !== challenge.challenger_id && inviterId !== challenge.opponent_id) {
      return { ok: false, reason: "You are not a participant in this challenge" };
    }
  } else {
    const inviter = participants.find((p) => p.user_id === inviterId);
    if (!inviter || inviter.status === "declined") {
      return { ok: false, reason: "You are not an active participant in this challenge" };
    }
  }

  // H2H path: duplicate check BEFORE self-invite (matches production order)
  if (challenge.lobby_type !== "group") {
    if (newUserId === challenge.challenger_id || newUserId === challenge.opponent_id) {
      return { ok: false, reason: "This user is already in the challenge" };
    }

    // Self-invite check (for H2H, only reachable if not already a duplicate)
    if (newUserId === inviterId) {
      return { ok: false, reason: "Cannot invite yourself" };
    }
  } else if (newUserId === inviterId) {
    // Group path: self-invite check BEFORE duplicate (matches production order)
    return { ok: false, reason: "Cannot invite yourself" };
  }

  // Lobby capacity
  const active = participants.filter((p) => p.status !== "declined");
  if (active.length >= MAX_LOBBY_SIZE) {
    return { ok: false, reason: `Lobby is full (max ${MAX_LOBBY_SIZE} participants)` };
  }

  // Duplicate check (group challenges only, after conversion)
  if (challenge.lobby_type === "group") {
    if (newUserId) {
      const existing = active.find((p) => p.user_id === newUserId);
      if (existing) {
        return { ok: false, reason: "This user is already in the challenge" };
      }
    }
    if (newEmail) {
      const normalized = newEmail.toLowerCase();
      const existing = active.find((p) => p.email?.toLowerCase() === normalized);
      if (existing) {
        return { ok: false, reason: "This email is already in the challenge" };
      }
    }
  }

  return { ok: true };
}

/**
 * Determines whether a kicked (declined) participant can be re-invited.
 * Mirrors the reactivation path in addParticipantToGroup.
 */
function findDeclinedRow(
  participants: Participant[],
  userId: string | null,
  email: string | null,
): Participant | null {
  if (userId) {
    return participants.find((p) => p.user_id === userId && p.status === "declined") ?? null;
  }
  if (email) {
    const normalized = email.toLowerCase();
    return participants.find((p) => p.email?.toLowerCase() === normalized && p.status === "declined") ?? null;
  }
  return null;
}

/**
 * Validates whether a participant can be kicked from a challenge.
 * Mirrors the validation in removeParticipantFromGroup.
 */
function canKickParticipant(
  challenge: MinimalChallenge,
  creatorId: string,
  targetUserId: string,
  participants: Participant[],
  picks: Pick[],
): { ok: boolean; reason?: string } {
  if (challenge.lobby_type !== "group") {
    return { ok: false, reason: "Can only remove participants from group challenges" };
  }

  if (challenge.status === "resolved" || challenge.status === "cancelled") {
    return { ok: false, reason: `Cannot remove participants from a ${challenge.status} challenge` };
  }

  // Verify requester is creator
  const creator = participants.find((p) => p.user_id === creatorId);
  if (!creator?.is_creator) {
    return { ok: false, reason: "Only the challenge creator can remove participants" };
  }

  // Cannot kick yourself
  if (targetUserId === creatorId) {
    return { ok: false, reason: "Cannot remove yourself — use cancel instead" };
  }

  // Find target
  const target = participants.find((p) => p.user_id === targetUserId);
  if (!target) {
    return { ok: false, reason: "Participant not found in this challenge" };
  }

  if (target.status === "declined") {
    return { ok: false, reason: "This participant has already declined" };
  }

  // Check for live games on target's card
  if (target.card_id) {
    const now = new Date();
    const hasLiveGames = picks
      .filter((p) => p.card_id === target.card_id)
      .some((p) => new Date(p.games.commence_time) <= now);

    if (hasLiveGames) {
      return { ok: false, reason: "Cannot remove a participant who has games in progress" };
    }
  }

  return { ok: true };
}

/**
 * Determines the result of kicking: should the challenge be cancelled?
 */
function shouldCancelAfterKick(
  participants: Participant[],
  kickedUserId: string,
): boolean {
  const remaining = participants
    .filter((p) => p.status !== "declined" && p.user_id !== kickedUserId);
  return remaining.length < MIN_LOBBY_SIZE;
}

/**
 * Determines H2H→group conversion outcome.
 * Returns the participant status for each existing player.
 */
function determineConversionStatuses(
  challenge: MinimalChallenge,
  challengerHasCard: boolean,
  opponentHasCard: boolean,
): { challengerStatus: ParticipantStatus; opponentStatus: ParticipantStatus } {
  const challengerStatus: ParticipantStatus = challengerHasCard ? "active" : "accepted";

  let opponentStatus: ParticipantStatus;
  if (opponentHasCard) {
    opponentStatus = "active";
  } else if (challenge.status === "pending") {
    opponentStatus = "invited";
  } else if (challenge.status === "accepted" || challenge.status === "active") {
    opponentStatus = "accepted";
  } else {
    opponentStatus = "invited";
  }

  return { challengerStatus, opponentStatus };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let counter = 0;

function makeChallenge(overrides: Partial<MinimalChallenge> = {}): MinimalChallenge {
  return {
    id: "ch-1",
    status: "pending",
    challenger_id: "creator",
    opponent_id: "opponent",
    lobby_type: "group",
    game_mode: "classic",
    ...overrides,
  };
}

function makeParticipant(overrides: Partial<Participant> = {}): Participant {
  counter++;
  return {
    id: `part-${counter}`,
    challenge_id: "ch-1",
    user_id: `user-${counter}`,
    email: null,
    status: "active",
    card_id: null,
    is_creator: false,
    ...overrides,
  };
}

beforeEach(() => {
  counter = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Adding participants (invite)", () => {
  describe("status-based blocking", () => {
    it("allows invite on draft challenges", () => {
      const ch = makeChallenge({ status: "draft", lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(true);
    });

    it("allows invite on pending challenges", () => {
      const ch = makeChallenge({ status: "pending", lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(true);
    });

    it("allows invite on accepted challenges", () => {
      const ch = makeChallenge({ status: "accepted", lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(true);
    });

    it("allows invite on active challenges", () => {
      const ch = makeChallenge({ status: "active", lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(true);
    });

    it("blocks invite on resolved challenges", () => {
      const ch = makeChallenge({ status: "resolved", lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/resolved/);
    });

    it("blocks invite on cancelled challenges", () => {
      const ch = makeChallenge({ status: "cancelled", lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/cancelled/);
    });
  });

  describe("1v1 invite authorization", () => {
    it("allows challenger to invite", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "user-new", null, []);
      expect(result.ok).toBe(true);
    });

    it("allows opponent to invite", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      const result = canAddParticipant(ch, "opponent", "user-new", null, []);
      expect(result.ok).toBe(true);
    });

    it("blocks non-participant from inviting", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      const result = canAddParticipant(ch, "random-user", "user-new", null, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not a participant/);
    });
  });

  describe("group invite authorization", () => {
    it("allows active participant to invite", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "inviter", status: "active" }),
        makeParticipant({ user_id: "other", status: "active" }),
      ];
      const result = canAddParticipant(ch, "inviter", "user-new", null, participants);
      expect(result.ok).toBe(true);
    });

    it("allows invited participant to invite others", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "inviter", status: "invited" }),
        makeParticipant({ user_id: "other", status: "active" }),
      ];
      const result = canAddParticipant(ch, "inviter", "user-new", null, participants);
      expect(result.ok).toBe(true);
    });

    it("blocks declined participant from inviting", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "kicked", status: "declined" }),
        makeParticipant({ user_id: "other", status: "active" }),
      ];
      const result = canAddParticipant(ch, "kicked", "user-new", null, participants);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not an active participant/);
    });

    it("blocks non-participant from inviting", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "member", status: "active" }),
      ];
      const result = canAddParticipant(ch, "outsider", "user-new", null, participants);
      expect(result.ok).toBe(false);
    });
  });

  describe("self-invite prevention", () => {
    it("blocks inviting yourself in 1v1 (hits duplicate check first)", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      // In H2H, the duplicate check fires before self-invite,
      // so "creator" is caught as "already in the challenge"
      const result = canAddParticipant(ch, "creator", "creator", null, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already in the challenge/);
    });

    it("blocks inviting yourself in group", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      ];
      const result = canAddParticipant(ch, "creator", "creator", null, participants);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Cannot invite yourself/);
    });
  });

  describe("duplicate prevention", () => {
    it("blocks inviting existing challenger in 1v1", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      const result = canAddParticipant(ch, "opponent", "creator", null, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already in the challenge/);
    });

    it("blocks inviting existing opponent in 1v1", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      const result = canAddParticipant(ch, "creator", "opponent", null, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already in the challenge/);
    });

    it("blocks inviting existing active user in group", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: "existing", status: "active" }),
      ];
      const result = canAddParticipant(ch, "creator", "existing", null, participants);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already in the challenge/);
    });

    it("blocks inviting existing email in group", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: null, email: "guest@example.com", status: "invited" }),
      ];
      const result = canAddParticipant(ch, "creator", null, "guest@example.com", participants);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already in the challenge/);
    });

    it("email duplicate check is case-insensitive", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: null, email: "Guest@Example.com", status: "invited" }),
      ];
      const result = canAddParticipant(ch, "creator", null, "guest@example.com", participants);
      expect(result.ok).toBe(false);
    });

    it("allows inviting a declined (kicked) user by user_id — reactivation path", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: "kicked", status: "declined" }),
        makeParticipant({ user_id: "other", status: "active" }),
      ];
      // "kicked" is declined → not in active list → not a duplicate
      const result = canAddParticipant(ch, "creator", "kicked", null, participants);
      expect(result.ok).toBe(true);
    });

    it("allows inviting a declined (kicked) user by email — reactivation path", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: null, email: "kicked@test.com", status: "declined" }),
      ];
      const result = canAddParticipant(ch, "creator", null, "kicked@test.com", participants);
      expect(result.ok).toBe(true);
    });
  });

  describe("lobby capacity", () => {
    it("blocks invite when lobby is full", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = Array.from({ length: MAX_LOBBY_SIZE }, (_, i) =>
        makeParticipant({ user_id: `user-${i}`, status: "active" })
      );
      // Creator is user-0 in this case
      participants[0].is_creator = true;
      participants[0].user_id = "creator";
      const result = canAddParticipant(ch, "creator", "user-new", null, participants);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/full/);
    });

    it("allows invite when at MAX_LOBBY_SIZE - 1", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = Array.from({ length: MAX_LOBBY_SIZE - 1 }, (_, i) =>
        makeParticipant({ user_id: `user-${i}`, status: "active" })
      );
      participants[0].is_creator = true;
      participants[0].user_id = "creator";
      const result = canAddParticipant(ch, "creator", "user-new", null, participants);
      expect(result.ok).toBe(true);
    });

    it("declined participants do not count toward lobby capacity", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        ...Array.from({ length: MAX_LOBBY_SIZE - 1 }, (_, i) =>
          makeParticipant({ user_id: `active-${i}`, status: "active" })
        ),
        makeParticipant({ user_id: "kicked", status: "declined" }),
      ];
      participants[0].is_creator = true;
      participants[0].user_id = "creator";
      const result = canAddParticipant(ch, "creator", "user-new", null, participants);
      expect(result.ok).toBe(true);
    });
  });
});

describe("Re-invite after kick (reactivation)", () => {
  it("finds declined row by user_id", () => {
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "kicked", status: "declined" }),
      makeParticipant({ user_id: "other", status: "active" }),
    ];
    const declined = findDeclinedRow(participants, "kicked", null);
    expect(declined).not.toBeNull();
    expect(declined!.user_id).toBe("kicked");
    expect(declined!.status).toBe("declined");
  });

  it("finds declined row by email (case-insensitive)", () => {
    const participants = [
      makeParticipant({ user_id: null, email: "Kicked@Example.com", status: "declined" }),
    ];
    const declined = findDeclinedRow(participants, null, "kicked@example.com");
    expect(declined).not.toBeNull();
    expect(declined!.email).toBe("Kicked@Example.com");
  });

  it("returns null for non-existent user", () => {
    const participants = [
      makeParticipant({ user_id: "creator", status: "active" }),
    ];
    const declined = findDeclinedRow(participants, "nobody", null);
    expect(declined).toBeNull();
  });

  it("returns null for active (non-declined) user", () => {
    const participants = [
      makeParticipant({ user_id: "active-user", status: "active" }),
    ];
    const declined = findDeclinedRow(participants, "active-user", null);
    expect(declined).toBeNull();
  });

  it("returns null when neither user_id nor email is provided", () => {
    const participants = [
      makeParticipant({ user_id: "someone", status: "declined" }),
    ];
    const declined = findDeclinedRow(participants, null, null);
    expect(declined).toBeNull();
  });
});

describe("Removing participants (kick)", () => {
  describe("authorization", () => {
    it("allows creator to kick non-creator participant", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: "target", status: "active" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(true);
    });

    it("blocks non-creator from kicking", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
        makeParticipant({ user_id: "member", status: "active" }),
        makeParticipant({ user_id: "target", status: "active" }),
      ];
      const result = canKickParticipant(ch, "member", "target", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Only the challenge creator/);
    });

    it("blocks creator from kicking themselves", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      ];
      const result = canKickParticipant(ch, "creator", "creator", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/Cannot remove yourself/);
    });
  });

  describe("status-based blocking", () => {
    it("blocks kick on resolved challenges", () => {
      const ch = makeChallenge({ status: "resolved", lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/resolved/);
    });

    it("blocks kick on cancelled challenges", () => {
      const ch = makeChallenge({ status: "cancelled", lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/cancelled/);
    });

    it("allows kick on active challenges", () => {
      const ch = makeChallenge({ status: "active", lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target" }),
        makeParticipant({ user_id: "other" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(true);
    });

    it("allows kick on pending challenges", () => {
      const ch = makeChallenge({ status: "pending", lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target", status: "invited" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(true);
    });

    it("blocks kick on 1v1 challenges", () => {
      const ch = makeChallenge({ lobby_type: "1v1" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/group challenges/);
    });

    it("blocks kick on already-declined participant", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target", status: "declined" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/already declined/);
    });

    it("blocks kick when participant not found", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
      ];
      const result = canKickParticipant(ch, "creator", "unknown", participants, []);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/not found/);
    });
  });

  describe("live game protection", () => {
    it("blocks kick when participant has live games", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target", card_id: "card-target" }),
      ];
      const picks: Pick[] = [
        { id: "pick-1", card_id: "card-target", games: { commence_time: new Date(Date.now() - 60_000).toISOString() } },
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, picks);
      expect(result.ok).toBe(false);
      expect(result.reason).toMatch(/games in progress/);
    });

    it("allows kick when participant has only future games", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target", card_id: "card-target" }),
      ];
      const picks: Pick[] = [
        { id: "pick-1", card_id: "card-target", games: { commence_time: new Date(Date.now() + 3_600_000).toISOString() } },
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, picks);
      expect(result.ok).toBe(true);
    });

    it("allows kick when participant has no card", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true }),
        makeParticipant({ user_id: "target", card_id: null, status: "invited" }),
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, []);
      expect(result.ok).toBe(true);
    });

    it("only checks picks for the target's card, not other cards", () => {
      const ch = makeChallenge({ lobby_type: "group" });
      const participants = [
        makeParticipant({ user_id: "creator", is_creator: true, card_id: "card-creator" }),
        makeParticipant({ user_id: "target", card_id: "card-target" }),
      ];
      // Creator has a live game, but target does not
      const picks: Pick[] = [
        { id: "pick-1", card_id: "card-creator", games: { commence_time: new Date(Date.now() - 60_000).toISOString() } },
        { id: "pick-2", card_id: "card-target", games: { commence_time: new Date(Date.now() + 3_600_000).toISOString() } },
      ];
      const result = canKickParticipant(ch, "creator", "target", participants, picks);
      expect(result.ok).toBe(true);
    });
  });
});

describe("Challenge cancellation after kick", () => {
  it("cancels when kick drops below MIN_LOBBY_SIZE", () => {
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "target", status: "active" }),
    ];
    expect(shouldCancelAfterKick(participants, "target")).toBe(true);
  });

  it("does not cancel when enough participants remain", () => {
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "member", status: "active" }),
      makeParticipant({ user_id: "target", status: "active" }),
    ];
    expect(shouldCancelAfterKick(participants, "target")).toBe(false);
  });

  it("excludes already-declined participants from remaining count", () => {
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "kicked-before", status: "declined" }),
      makeParticipant({ user_id: "member", status: "active" }),
      makeParticipant({ user_id: "target", status: "active" }),
    ];
    // After kicking "target": creator + member = 2 remaining → MIN_LOBBY_SIZE
    expect(shouldCancelAfterKick(participants, "target")).toBe(false);
  });

  it("cancels with multiple prior declines plus this kick", () => {
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "declined-1", status: "declined" }),
      makeParticipant({ user_id: "declined-2", status: "declined" }),
      makeParticipant({ user_id: "target", status: "active" }),
    ];
    // After kicking "target": only creator remains → cancel
    expect(shouldCancelAfterKick(participants, "target")).toBe(true);
  });
});

describe("1v1 → group conversion", () => {
  describe("participant status mapping", () => {
    it("challenger with card gets active status", () => {
      const ch = makeChallenge({ status: "pending", lobby_type: "1v1" });
      const { challengerStatus } = determineConversionStatuses(ch, true, false);
      expect(challengerStatus).toBe("active");
    });

    it("challenger without card gets accepted status", () => {
      const ch = makeChallenge({ status: "pending", lobby_type: "1v1" });
      const { challengerStatus } = determineConversionStatuses(ch, false, false);
      expect(challengerStatus).toBe("accepted");
    });

    it("opponent with card gets active status", () => {
      const ch = makeChallenge({ status: "accepted", lobby_type: "1v1" });
      const { opponentStatus } = determineConversionStatuses(ch, false, true);
      expect(opponentStatus).toBe("active");
    });

    it("opponent without card on pending challenge gets invited status", () => {
      const ch = makeChallenge({ status: "pending", lobby_type: "1v1" });
      const { opponentStatus } = determineConversionStatuses(ch, true, false);
      expect(opponentStatus).toBe("invited");
    });

    it("opponent without card on accepted challenge gets accepted status", () => {
      const ch = makeChallenge({ status: "accepted", lobby_type: "1v1" });
      const { opponentStatus } = determineConversionStatuses(ch, true, false);
      expect(opponentStatus).toBe("accepted");
    });

    it("opponent without card on active challenge gets accepted status", () => {
      const ch = makeChallenge({ status: "active", lobby_type: "1v1" });
      const { opponentStatus } = determineConversionStatuses(ch, true, false);
      expect(opponentStatus).toBe("accepted");
    });

    it("both have cards: both get active", () => {
      const ch = makeChallenge({ status: "active", lobby_type: "1v1" });
      const { challengerStatus, opponentStatus } = determineConversionStatuses(ch, true, true);
      expect(challengerStatus).toBe("active");
      expect(opponentStatus).toBe("active");
    });

    it("neither has cards on draft: challenger accepted, opponent invited", () => {
      const ch = makeChallenge({ status: "draft", lobby_type: "1v1" });
      const { challengerStatus, opponentStatus } = determineConversionStatuses(ch, false, false);
      expect(challengerStatus).toBe("accepted");
      expect(opponentStatus).toBe("invited");
    });
  });
});

describe("Kick-then-reinvite full cycle", () => {
  it("participant can be re-invited after kick (declined → reactivated)", () => {
    const ch = makeChallenge({ lobby_type: "group" });
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "target", status: "declined" }),
      makeParticipant({ user_id: "other", status: "active" }),
    ];

    // Step 1: verify the kicked user is findable as declined
    const declined = findDeclinedRow(participants, "target", null);
    expect(declined).not.toBeNull();

    // Step 2: verify they can be re-invited (not blocked as duplicate)
    const addResult = canAddParticipant(ch, "creator", "target", null, participants);
    expect(addResult.ok).toBe(true);
  });

  it("email-invited user can be re-invited after kick", () => {
    const ch = makeChallenge({ lobby_type: "group" });
    const participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: null, email: "guest@test.com", status: "declined" }),
      makeParticipant({ user_id: "other", status: "active" }),
    ];

    // Find declined row
    const declined = findDeclinedRow(participants, null, "guest@test.com");
    expect(declined).not.toBeNull();

    // Can re-invite
    const addResult = canAddParticipant(ch, "creator", null, "guest@test.com", participants);
    expect(addResult.ok).toBe(true);
  });

  it("multiple kick-reinvite cycles work correctly", () => {
    const ch = makeChallenge({ lobby_type: "group" });

    // First kick: target is declined
    let participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "target", status: "declined" }),
      makeParticipant({ user_id: "other", status: "active" }),
    ];

    // Re-invite succeeds
    expect(canAddParticipant(ch, "creator", "target", null, participants).ok).toBe(true);
    expect(findDeclinedRow(participants, "target", null)).not.toBeNull();

    // Simulate reactivation: target is now invited again
    participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "target", status: "invited" }),
      makeParticipant({ user_id: "other", status: "active" }),
    ];

    // Second kick
    const kickResult = canKickParticipant(ch, "creator", "target", participants, []);
    expect(kickResult.ok).toBe(true);

    // After second kick: target is declined again
    participants = [
      makeParticipant({ user_id: "creator", status: "active", is_creator: true }),
      makeParticipant({ user_id: "target", status: "declined" }),
      makeParticipant({ user_id: "other", status: "active" }),
    ];

    // Second re-invite still works
    expect(canAddParticipant(ch, "creator", "target", null, participants).ok).toBe(true);
    expect(findDeclinedRow(participants, "target", null)).not.toBeNull();
  });
});
