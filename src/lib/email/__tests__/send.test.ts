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
