import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  getUnsubscribeUrl,
} from "../unsubscribe-token";

// Provide a stable secret for tests
beforeEach(() => {
  vi.stubEnv("UNSUBSCRIBE_SECRET", "test-secret-key-for-unit-tests");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://alternapick.com");
});

describe("createUnsubscribeToken / verifyUnsubscribeToken", () => {
  it("roundtrips a standard email", () => {
    const email = "user@example.com";
    const token = createUnsubscribeToken(email);
    expect(verifyUnsubscribeToken(token)).toBe(email);
  });

  it("normalises email to lowercase", () => {
    const token = createUnsubscribeToken("User@Example.COM");
    expect(verifyUnsubscribeToken(token)).toBe("user@example.com");
  });

  it("trims whitespace from email", () => {
    const token = createUnsubscribeToken("  user@example.com  ");
    expect(verifyUnsubscribeToken(token)).toBe("user@example.com");
  });

  it("produces deterministic tokens for the same email", () => {
    const a = createUnsubscribeToken("user@example.com");
    const b = createUnsubscribeToken("user@example.com");
    expect(a).toBe(b);
  });

  it("produces different tokens for different emails", () => {
    const a = createUnsubscribeToken("alice@example.com");
    const b = createUnsubscribeToken("bob@example.com");
    expect(a).not.toBe(b);
  });

  it("handles email with special characters", () => {
    const email = "user+tag@sub.example.com";
    const token = createUnsubscribeToken(email);
    expect(verifyUnsubscribeToken(token)).toBe(email);
  });

  it("handles email with unicode characters", () => {
    const email = "user@exämple.com";
    const token = createUnsubscribeToken(email);
    expect(verifyUnsubscribeToken(token)).toBe(email);
  });
});

describe("verifyUnsubscribeToken — invalid inputs", () => {
  it("returns null for empty string", () => {
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("returns null for token without dot separator", () => {
    expect(verifyUnsubscribeToken("nodothere")).toBeNull();
  });

  it("returns null for tampered payload", () => {
    const token = createUnsubscribeToken("user@example.com");
    const [, hmac] = token.split(".");
    const tamperedPayload = Buffer.from("hacker@evil.com").toString("base64url");
    expect(verifyUnsubscribeToken(`${tamperedPayload}.${hmac}`)).toBeNull();
  });

  it("returns null for tampered HMAC", () => {
    const token = createUnsubscribeToken("user@example.com");
    const [payload] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.deadbeef`)).toBeNull();
  });

  it("returns null for truncated HMAC", () => {
    const token = createUnsubscribeToken("user@example.com");
    const [payload, hmac] = token.split(".");
    expect(verifyUnsubscribeToken(`${payload}.${hmac.slice(0, 10)}`)).toBeNull();
  });

  it("returns null for invalid base64url payload", () => {
    expect(verifyUnsubscribeToken("!!!invalid!!!.abc123")).toBeNull();
  });
});

describe("getUnsubscribeUrl", () => {
  it("returns a full URL with token parameter", () => {
    const url = getUnsubscribeUrl("user@example.com");
    expect(url).toMatch(/^https:\/\/alternapick\.com\/api\/email\/unsubscribe\?token=.+/);
  });

  it("produces a URL whose token verifies back to the email", () => {
    const url = getUnsubscribeUrl("user@example.com");
    const token = new URL(url).searchParams.get("token")!;
    expect(verifyUnsubscribeToken(token)).toBe("user@example.com");
  });
});
