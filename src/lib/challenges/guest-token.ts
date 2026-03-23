/**
 * Guest Token Service
 *
 * DB-backed single-use tokens for email-based challenge invites.
 * Uses (admin.from() as any) to work around the known Supabase PostgREST
 * type inference issue with chained queries (same pattern as queries.ts).
 */

import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { baseUrl } from "@/lib/email/config";
import { logError } from "@/lib/logger";
import type { GuestToken } from "@/lib/supabase/types";

const TOKEN_EXPIRY_DAYS = 7;

type TokenRow = Pick<GuestToken, "challenge_id" | "email" | "expires_at" | "used_at">;

function getExpiresAt(): string {
  const date = new Date();
  date.setDate(date.getDate() + TOKEN_EXPIRY_DAYS);
  return date.toISOString();
}

/** Generate a guest token, store it in the DB, and return the guest pick URL. */
export async function createGuestToken(
  challengeId: string,
  email: string,
): Promise<{ token: string; url: string }> {
  const token = randomUUID();
  const admin = createAdminClient();

  const { error } = await (admin.from("guest_tokens") as any).insert({
    token,
    challenge_id: challengeId,
    email: email.toLowerCase().trim(),
    expires_at: getExpiresAt(),
  });

  if (error) {
    logError("guest-token", "Failed to create guest token", "createGuestToken", error);
    throw new Error("Failed to create guest token");
  }

  const url = `${baseUrl}/challenges/${challengeId}/guest?token=${token}`;
  return { token, url };
}

/** Verify a token exists, is not expired, and has not been used. Returns null if invalid. */
export async function verifyGuestToken(
  token: string,
): Promise<{ challengeId: string; email: string } | null> {
  const admin = createAdminClient();

  const { data, error } = (await (admin.from("guest_tokens") as any)
    .select("challenge_id, email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle()) as { data: TokenRow | null; error: unknown };

  if (error) {
    logError("guest-token", "Failed to verify guest token", "verifyGuestToken", error);
    return null;
  }

  if (!data) return null;
  if (data.used_at) return null;
  if (new Date(data.expires_at) < new Date()) return null;

  return { challengeId: data.challenge_id, email: data.email };
}

/**
 * Atomically mark a token as used (only if not already consumed).
 * Returns true if the token was successfully claimed, false if it was
 * already used by a concurrent request.
 */
export async function markTokenUsed(token: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data, error } = (await (admin.from("guest_tokens") as any)
    .update({ used_at: new Date().toISOString() })
    .eq("token", token)
    .is("used_at", null)
    .select("token")
    .maybeSingle()) as { data: { token: string } | null; error: unknown };

  if (error) {
    logError("guest-token", "Failed to mark token as used", "markTokenUsed", error);
    throw new Error("Failed to mark token as used");
  }

  // If data is null, the token was already consumed by another request
  return data !== null;
}

