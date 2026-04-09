import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";
import type { NotificationPreferences } from "@/lib/supabase/types";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "fake" }, error: null });

vi.mock("../client", () => ({
  getResendClient: () => ({ emails: { send: sendMock } }),
}));

vi.mock("@/lib/feature-flags", () => ({
  getFlag: vi.fn().mockResolvedValue(null),
  getFlagValue: vi.fn().mockResolvedValue("*"),
}));

vi.mock("@/lib/logger", () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
  logInfo: vi.fn(),
}));

// Mock the admin client used by the suppression lookup. The chainable proxy
// resolves `.maybeSingle()` to whatever `suppressionResult` is set to in the
// current test, and records every call so tests can assert filters.
let suppressionResult: { data: unknown; error: unknown } = { data: null, error: null };
const suppressionEqMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => {
      const handler: ProxyHandler<Record<string, unknown>> = {
        get(_target, prop) {
          if (prop === "maybeSingle") {
            return () => Promise.resolve(suppressionResult);
          }
          return (...args: unknown[]) => {
            if (prop === "eq") suppressionEqMock(...args);
            return new Proxy({}, handler);
          };
        },
      };
      return new Proxy({}, handler);
    },
  }),
}));

import { sendEmail, shouldSendEmail } from "../send";

const fakeReact = null as unknown as ReactElement;

describe("shouldSendEmail", () => {
  it("returns true when preferences is null (default to sending)", () => {
    expect(shouldSendEmail("card_resolved", null)).toBe(true);
    expect(shouldSendEmail("challenge_received", null)).toBe(true);
    expect(shouldSendEmail("friend_request", null)).toBe(true);
  });

  it("returns true when preferences is undefined (default to sending)", () => {
    expect(shouldSendEmail("card_resolved", undefined)).toBe(true);
  });

  it("returns true when preference key is missing from preferences object", () => {
    // Empty object — no keys set, should default to enabled
    const prefs = {} as NotificationPreferences;
    expect(shouldSendEmail("card_resolved", prefs)).toBe(true);
    expect(shouldSendEmail("challenge_received", prefs)).toBe(true);
  });

  it("returns true when preference key is explicitly true", () => {
    const prefs = {
      email_card_resolved: true,
    } as NotificationPreferences;
    expect(shouldSendEmail("card_resolved", prefs)).toBe(true);
  });

  it("returns false when preference key is explicitly false", () => {
    const prefs = {
      email_card_resolved: false,
    } as NotificationPreferences;
    expect(shouldSendEmail("card_resolved", prefs)).toBe(false);
  });

  it("returns false for all email types when all are disabled (post-unsubscribe)", () => {
    const prefs = {
      email_card_resolved: false,
      email_challenge_received: false,
      email_challenge_resolved: false,
      email_friend_request: false,
    } as NotificationPreferences;

    expect(shouldSendEmail("card_resolved", prefs)).toBe(false);
    expect(shouldSendEmail("challenge_received", prefs)).toBe(false);
    expect(shouldSendEmail("challenge_resolved", prefs)).toBe(false);
    expect(shouldSendEmail("friend_request", prefs)).toBe(false);
  });

  it("returns false for notification types that have no email key", () => {
    // These types are not in NOTIFICATION_TYPE_TO_EMAIL_KEY
    expect(shouldSendEmail("friend_accepted", null)).toBe(false);
    expect(shouldSendEmail("challenge_accepted", null)).toBe(false);
    expect(shouldSendEmail("achievement_unlocked", null)).toBe(false);
    expect(shouldSendEmail("reaction_received", null)).toBe(false);
    expect(shouldSendEmail("daily_recap", null)).toBe(false);
  });

});

describe("sendEmail deliverability defaults", () => {
  beforeEach(() => {
    // The Resend client is mocked at module level, so RESEND_API_KEY is not
    // read at runtime — only EMAIL_FROM needs resetting between tests.
    sendMock.mockClear();
    suppressionEqMock.mockClear();
    suppressionResult = { data: null, error: null };
    delete process.env.EMAIL_FROM;
  });

  async function callSend(extra: Record<string, unknown> = {}) {
    await sendEmail({
      to: "user@example.com",
      subject: "hi",
      react: fakeReact,
      ...extra,
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    return sendMock.mock.calls[0][0] as Record<string, unknown>;
  }

  it("defaults From to notifications@alternapick.com", async () => {
    const args = await callSend();
    expect(args.from).toBe("AlternaPick <notifications@alternapick.com>");
  });

  it("respects EMAIL_FROM env override", async () => {
    process.env.EMAIL_FROM = "Test <foo@example.com>";
    const args = await callSend();
    expect(args.from).toBe("Test <foo@example.com>");
  });

  it("does NOT add List-Unsubscribe headers when unsubscribeUrl is omitted", async () => {
    const args = await callSend();
    const headers = args.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toBeUndefined();
    expect(headers["List-Unsubscribe-Post"]).toBeUndefined();
  });

  it("adds List-Unsubscribe headers only when unsubscribeUrl is provided", async () => {
    const args = await callSend({ unsubscribeUrl: "https://example.com/unsub" });
    const headers = args.headers as Record<string, string>;
    expect(headers["List-Unsubscribe"]).toBe("<https://example.com/unsub>");
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("always sets a unique X-Entity-Ref-ID header", async () => {
    const first = await callSend();
    sendMock.mockClear();
    const second = await callSend();
    const firstRef = (first.headers as Record<string, string>)["X-Entity-Ref-ID"];
    const secondRef = (second.headers as Record<string, string>)["X-Entity-Ref-ID"];
    expect(firstRef).toBeDefined();
    expect(secondRef).toBeDefined();
    expect(firstRef).not.toBe(secondRef);
  });
});

describe("sendEmail bounce/complaint suppression", () => {
  beforeEach(() => {
    sendMock.mockClear();
    suppressionEqMock.mockClear();
    suppressionResult = { data: null, error: null };
    delete process.env.EMAIL_FROM;
  });

  async function trySend() {
    return sendEmail({
      to: "user@example.com",
      subject: "hi",
      react: null as unknown as ReactElement,
    });
  }

  it("sends normally when the address is NOT in the suppression list", async () => {
    suppressionResult = { data: null, error: null };

    const result = await trySend();

    expect(result).toEqual({ success: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("blocks the send when the address has a prior bounce event", async () => {
    suppressionResult = { data: { event_type: "email.bounced" }, error: null };

    const result = await trySend();

    expect(result.success).toBe(false);
    expect(result.error).toBe("Recipient suppressed");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("blocks the send when the address has a prior complaint event", async () => {
    suppressionResult = { data: { event_type: "email.complained" }, error: null };

    const result = await trySend();

    expect(result.success).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("queries with the lowercased recipient address", async () => {
    suppressionResult = { data: null, error: null };

    await sendEmail({
      to: "User@Example.COM",
      subject: "hi",
      react: null as unknown as ReactElement,
    });

    // The .eq("email_to", ...) call should have received the lowercased form
    const eqCalls = suppressionEqMock.mock.calls;
    const emailToCall = eqCalls.find((c) => c[0] === "email_to");
    expect(emailToCall).toBeDefined();
    expect(emailToCall![1]).toBe("user@example.com");
  });

  it("does NOT block sends when the suppression lookup fails (fail-open)", async () => {
    // A transient DB error should not block legitimate sends — the comment
    // in send.ts spells this out as the intended behavior.
    suppressionResult = { data: null, error: { message: "db down" } };

    const result = await trySend();

    expect(result).toEqual({ success: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});

describe("shouldSendEmail individual preferences", () => {
  it("respects individual preferences independently", () => {
    const prefs = {
      email_card_resolved: false,
      email_challenge_received: true,
      email_challenge_resolved: false,
      email_friend_request: true,
    } as NotificationPreferences;

    expect(shouldSendEmail("card_resolved", prefs)).toBe(false);
    expect(shouldSendEmail("challenge_received", prefs)).toBe(true);
    expect(shouldSendEmail("challenge_resolved", prefs)).toBe(false);
    expect(shouldSendEmail("friend_request", prefs)).toBe(true);
  });
});
