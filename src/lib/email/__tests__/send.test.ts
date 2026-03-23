import { describe, it, expect } from "vitest";
import { shouldSendEmail } from "../send";
import type { NotificationPreferences } from "@/lib/supabase/types";

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
