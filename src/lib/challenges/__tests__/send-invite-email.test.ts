import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendChallengeInviteEmail } from "../send-invite-email";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockLogError = vi.fn();
const mockLogWarn = vi.fn();
vi.mock("@/lib/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  logWarn: (...args: unknown[]) => mockLogWarn(...args),
}));

const mockSendEmail = vi.fn();
vi.mock("@/lib/email/send", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

const mockGetChallengeInviteEmailProps = vi.fn();
vi.mock("@/lib/email/templates/challenge-invite", () => ({
  getChallengeInviteEmailProps: (...args: unknown[]) => mockGetChallengeInviteEmailProps(...args),
}));

const mockCreateGuestToken = vi.fn();
vi.mock("@/lib/challenges/guest-token", () => ({
  createGuestToken: (...args: unknown[]) => mockCreateGuestToken(...args),
}));

/** Chainable query builder for the Supabase mock. */
let typedFromResult: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@/lib/supabase/typed-queries", () => ({
  typedFrom: () => {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) => resolve(typedFromResult);
        }
        if (prop === "catch" || prop === "finally") return undefined;
        return () => new Proxy({}, handler);
      },
    };
    return new Proxy({}, handler);
  },
}));

beforeEach(() => {
  typedFromResult = { data: null, error: null };
  mockLogError.mockClear();
  mockLogWarn.mockClear();
  mockSendEmail.mockClear();
  mockGetChallengeInviteEmailProps.mockClear();
  mockCreateGuestToken.mockClear();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultOpts = {
  challengeId: "c1",
  challengerId: "user-1",
  opponentEmail: "opponent@example.com",
  gameMode: "classic" as const,
  message: null,
};

// Fake admin client — just passed through
const fakeAdmin = {} as Parameters<typeof sendChallengeInviteEmail>[0];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("sendChallengeInviteEmail", () => {
  it("fetches challenger profile, creates guest token, and sends email", async () => {
    typedFromResult = { data: { username: "Challenger1" }, error: null };
    mockCreateGuestToken.mockResolvedValue({ token: "t1", url: "https://example.com/guest?token=t1" });
    mockGetChallengeInviteEmailProps.mockReturnValue({
      subject: "Challenge!",
      react: "react-element",
      text: "plain text",
    });

    await sendChallengeInviteEmail(fakeAdmin, defaultOpts);

    expect(mockCreateGuestToken).toHaveBeenCalledWith("c1", "opponent@example.com");
    expect(mockGetChallengeInviteEmailProps).toHaveBeenCalledWith(
      expect.objectContaining({
        challengerUsername: "Challenger1",
        guestPickUrl: "https://example.com/guest?token=t1",
      }),
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "opponent@example.com",
        subject: "Challenge!",
      }),
    );
  });

  it('uses "Someone" as name when challenger profile fetch fails', async () => {
    typedFromResult = { data: null, error: { message: "Profile error" } };
    mockCreateGuestToken.mockResolvedValue({ token: "t1", url: "https://example.com/guest?token=t1" });
    mockGetChallengeInviteEmailProps.mockReturnValue({
      subject: "Challenge!",
      react: "react-element",
      text: "plain text",
    });

    await sendChallengeInviteEmail(fakeAdmin, defaultOpts);

    expect(mockLogWarn).toHaveBeenCalledWith(
      "challenges",
      "Failed to fetch challenger profile for invite email",
      expect.objectContaining({ message: "Profile error" }),
    );
    expect(mockGetChallengeInviteEmailProps).toHaveBeenCalledWith(
      expect.objectContaining({ challengerUsername: "Someone" }),
    );
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("logs error when guest token creation fails, does not throw", async () => {
    typedFromResult = { data: { username: "Challenger1" }, error: null };
    mockCreateGuestToken.mockRejectedValue(new Error("Token creation failed"));

    await expect(sendChallengeInviteEmail(fakeAdmin, defaultOpts)).resolves.toBeUndefined();

    expect(mockLogError).toHaveBeenCalledWith(
      "challenges",
      "Failed to send challenge invite email",
      "sendChallengeInviteEmail",
      expect.any(Error),
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("catches and logs general errors without throwing", async () => {
    typedFromResult = { data: { username: "Challenger1" }, error: null };
    mockCreateGuestToken.mockResolvedValue({ token: "t1", url: "https://example.com/guest?token=t1" });
    mockGetChallengeInviteEmailProps.mockImplementation(() => {
      throw new Error("Template error");
    });

    await expect(sendChallengeInviteEmail(fakeAdmin, defaultOpts)).resolves.toBeUndefined();

    expect(mockLogError).toHaveBeenCalledWith(
      "challenges",
      "Failed to send challenge invite email",
      "sendChallengeInviteEmail",
      expect.any(Error),
    );
  });
});
