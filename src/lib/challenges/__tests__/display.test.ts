import { describe, it, expect } from "vitest";
import { getOpponentDisplayName } from "../display";
import type { ChallengeProfile } from "../queries";

const makeProfile = (overrides: Partial<ChallengeProfile> = {}): ChallengeProfile => ({
  id: "user-1",
  username: "jdoe",
  display_name: null,
  avatar_url: null,
  icon_config: null,
  ...overrides,
});

describe("getOpponentDisplayName", () => {
  it("returns display_name when available", () => {
    expect(
      getOpponentDisplayName(makeProfile({ display_name: "John Doe" }), null),
    ).toBe("John Doe");
  });

  it("falls back to username when display_name is null", () => {
    expect(
      getOpponentDisplayName(makeProfile({ username: "jdoe" }), null),
    ).toBe("jdoe");
  });

  it("returns masked email when opponent is null but email exists", () => {
    expect(getOpponentDisplayName(null, "john@gmail.com")).toBe(
      "j***@gmail.com",
    );
  });

  it("returns 'Invited' when both opponent and email are null", () => {
    expect(getOpponentDisplayName(null, null)).toBe("Invited");
  });

  it("returns 'Invited' when email is undefined", () => {
    expect(getOpponentDisplayName(null, undefined)).toBe("Invited");
  });

  it("prefers profile over email", () => {
    expect(
      getOpponentDisplayName(makeProfile({ username: "jdoe" }), "john@gmail.com"),
    ).toBe("jdoe");
  });
});
