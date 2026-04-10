import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUuid } from "@/lib/admin/helpers";
import { badRequest, handleApiError, notFound } from "@/lib/api/errors";
import { logError, logInfo } from "@/lib/logger";
import type { NotificationPreferences } from "@/lib/supabase/types";

const ENDPOINT = "PATCH /api/admin/users/[userId]/notification-preferences";

/**
 * Allowlist of preference keys an admin is permitted to set. Locked down to
 * the exact set in `NotificationPreferences` so a typo or malicious payload
 * can't pollute the JSONB column with arbitrary keys.
 */
const ALLOWED_KEYS = new Set<keyof NotificationPreferences>([
  "friend_request",
  "friend_accepted",
  "challenge_received",
  "challenge_accepted",
  "challenge_resolved",
  "card_resolved",
  "achievement_unlocked",
  "reaction_received",
  "daily_recap",
  "email_card_resolved",
  "email_challenge_received",
  "email_challenge_resolved",
  "email_friend_request",
]);

/**
 * PATCH /api/admin/users/:userId/notification-preferences
 *
 * Allows admins to view-and-edit any user's notification preferences from the
 * dashboard. Used for support cases where a user has asked verbally to be
 * opted out of an email type and we don't want them to log in and toggle it
 * themselves, or for debugging "why am I not getting emails" questions.
 *
 * Body: a partial `NotificationPreferences` object — only the keys to change.
 * Unknown keys are rejected with 400 to prevent JSONB pollution.
 *
 * Returns the updated `notification_preferences` object on success.
 *
 * Audit: every change is logged via `logInfo("admin-prefs", ...)` with the
 * acting admin's id, the target user's id, and the diff. Future enhancement
 * is a dedicated audit table; for now structured log lines are enough.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { userId } = await params;
    if (!isValidUuid(userId)) {
      return badRequest("Invalid user ID format");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return badRequest("Body must be a JSON object");
    }

    const updates = body as Record<string, unknown>;

    // Validate every key + value before touching the DB. Reject the whole
    // request on the first invalid entry — partial updates would be
    // confusing to debug.
    const sanitized: Partial<NotificationPreferences> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.has(key as keyof NotificationPreferences)) {
        return badRequest(`Unknown preference key: ${key}`);
      }
      if (typeof value !== "boolean") {
        return badRequest(
          `Preference values must be boolean, got ${typeof value} for ${key}`,
        );
      }
      (sanitized as Record<string, boolean>)[key] = value;
    }

    if (Object.keys(sanitized).length === 0) {
      return badRequest("No valid preferences to update");
    }

    const admin = createAdminClient();

    // Fetch the existing row so we can merge + log the diff
    const { data: existing, error: fetchError } = await (admin.from("profiles") as any)
      .select("id, username, notification_preferences")
      .eq("id", userId)
      .single();

    // Distinguish "no rows" (PGRST116 — user doesn't exist, return 404)
    // from a real DB error (network failure, query error — log + return 500).
    if (fetchError) {
      const pgCode = (fetchError as { code?: string }).code;
      if (pgCode === "PGRST116") {
        return notFound("User");
      }
      logError("admin-prefs", `Failed to fetch profile for user ${userId}`, ENDPOINT, fetchError);
      return NextResponse.json({ error: "Failed to fetch user profile" }, { status: 500 });
    }
    if (!existing) {
      return notFound("User");
    }

    // The DB column is JSONB and may legitimately be empty or partial — treat
    // it as a loose record at the merge layer. Validation upstream guarantees
    // every key in `sanitized` is allowed and boolean.
    const currentPrefs =
      (existing.notification_preferences as Record<string, boolean> | null) ??
      {};
    const merged: Record<string, boolean> = {
      ...currentPrefs,
      ...(sanitized as Record<string, boolean>),
    };

    const { error: updateError } = await (admin.from("profiles") as any)
      .update({ notification_preferences: merged })
      .eq("id", userId);

    if (updateError) {
      logError(
        "admin-prefs",
        `Failed to update notification preferences for user ${userId}`,
        ENDPOINT,
        updateError,
      );
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 },
      );
    }

    // Audit log: who changed what for whom. Uses opaque IDs only — no
    // emails, usernames, or other PII per CLAUDE.md rule #11.
    const changedKeys = Object.keys(sanitized);
    logInfo(
      "admin-prefs",
      `Admin ${auth.user.id} updated notification_preferences for user ${userId} (${changedKeys.length} key(s): ${changedKeys.join(", ")})`,
    );

    return NextResponse.json({
      notificationPreferences: merged,
    });
  } catch (error) {
    return handleApiError(error, "Failed to update notification preferences");
  }
}
