import type { ReactElement } from "react";
import { getResendClient } from "./client";
import { logError, logWarn } from "@/lib/logger";
import { getFlag } from "@/lib/feature-flags";
import type {
  NotificationType,
  NotificationPreferences,
} from "@/lib/supabase/types";
import { NOTIFICATION_TYPE_TO_EMAIL_KEY } from "@/lib/supabase/types";

/**
 * Check whether an email should be sent for a given notification type
 * based on the user's preferences.
 *
 * - Returns `false` if the notification type has no associated email key
 *   (meaning emails are not supported for that type).
 * - Returns `true` if preferences is null/undefined (backward compatible —
 *   default to sending).
 * - Returns `true` if the preference key is not present in the user's
 *   preferences (default to enabled).
 * - Otherwise returns the boolean value from preferences.
 */
export function shouldSendEmail(
  notificationType: NotificationType,
  preferences: NotificationPreferences | null | undefined,
): boolean {
  const emailKey = NOTIFICATION_TYPE_TO_EMAIL_KEY[notificationType];

  // This notification type doesn't support emails
  if (!emailKey) return false;

  // No preferences saved — default to sending
  if (!preferences) return true;

  // If the key exists in preferences, respect it; otherwise default to true
  const value = preferences[emailKey];
  return value !== false;
}

interface SendEmailParams {
  to: string;
  subject: string;
  react: ReactElement;
  text?: string;
  /**
   * Pre-generated unsubscribe URL for List-Unsubscribe headers.
   *
   * IMPORTANT: Only pass this for marketing/digest emails (e.g. weekly recap).
   * Transactional emails (challenge invites, friend requests, card results)
   * MUST NOT pass this — `List-Unsubscribe` is a strong "bulk mail" signal to
   * Gmail and pulls transactional mail into the Promotions tab.
   */
  unsubscribeUrl?: string;
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email via Resend with blocklist filtering.
 *
 * Filtering layers, in order:
 *   1. Global kill switch — `email_enabled` feature flag
 *   2. Manual blocklist — `email_blocklist` feature flag (admin-managed list of
 *      addresses that should NEVER receive notifications). Enforced only when
 *      `email_blocklist.enabled` is true, so admins can temporarily disable
 *      enforcement without losing the list.
 *   3. (Future) Auto-suppression — addresses with prior bounce/complaint events
 *      from the Resend webhook (PR #154 adds this in `email_events`).
 *
 * - Returns early (no error) if RESEND_API_KEY is missing.
 * - Never throws — all errors are caught and returned in the result.
 */
export async function sendEmail({
  to,
  subject,
  react,
  text,
  unsubscribeUrl,
}: SendEmailParams): Promise<SendEmailResult> {
  try {
    // Step 0: Check global email toggle
    const emailEnabledFlag = await getFlag("email_enabled");
    if (emailEnabledFlag !== null && !emailEnabledFlag.enabled) {
      logWarn("email", "sendEmail skipped: email_enabled flag is off");
      return { success: false, error: "Email sending is disabled" };
    }

    // Step 1: Get Resend client
    const resend = getResendClient();
    if (!resend) {
      logWarn("email", "No RESEND_API_KEY configured, skipping");
      return { success: false, error: "No API key" };
    }

    const recipientLower = to.toLowerCase().trim();

    // Step 2: Manual blocklist. Enforced only when the flag is enabled, so
    // admins can temporarily disable enforcement (emergency override) without
    // erasing the curated list.
    const blocklistFlag = await getFlag("email_blocklist");
    if (blocklistFlag?.enabled) {
      const blockedEmails = (blocklistFlag.value ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (blockedEmails.includes(recipientLower)) {
        logWarn("email", "sendEmail skipped: recipient is on the blocklist");
        return { success: false, error: "Recipient on blocklist" };
      }
    }

    // Step 3: Send the email
    const from =
      process.env.EMAIL_FROM || "AlternaPick <notifications@alternapick.com>";
    const replyTo =
      process.env.EMAIL_REPLY_TO || "support@alternapick.com";

    const unsubscribeHeaders: Record<string, string> = unsubscribeUrl
      ? {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : {};

    await resend.emails.send({
      from,
      replyTo,
      to,
      subject,
      react,
      text,
      headers: {
        // Unique per email — prevents Gmail from collapsing unrelated
        // transactional emails into the same conversation thread.
        "X-Entity-Ref-ID": crypto.randomUUID(),
        ...unsubscribeHeaders,
      },
    });
    // NOTE: Resend's click/open tracking must be disabled in the Resend
    // dashboard (Domain settings → alternapick.com → toggle off Click Tracking
    // and Open Tracking). The SDK does not expose per-send tracking options.
    // Tracking rewrites links through `resend-clicks-a.com`, which Gmail's
    // classifier treats as a strong "bulk/marketing" signal and pulls
    // transactional mail into Promotions.

    return { success: true };
  } catch (err) {
    // Step 5: Catch all errors
    const message = err instanceof Error ? err.message : String(err);
    logError("email", `sendEmail failed: ${message}`, undefined, err);
    return { success: false, error: message };
  }
}
