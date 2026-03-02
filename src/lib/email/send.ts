import type { ReactElement } from "react";
import { getResendClient } from "./client";
import { logError } from "@/lib/logger";
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
}

interface SendEmailResult {
  success: boolean;
  error?: string;
}

/**
 * Send an email via Resend with allowlist filtering.
 *
 * - Returns early (no error) if RESEND_API_KEY is missing.
 * - Checks EMAIL_ALLOWLIST env var: comma-separated list of allowed emails,
 *   or `*` to allow all recipients. If recipient is not on the list, the
 *   email is silently skipped.
 * - Never throws — all errors are caught and returned in the result.
 */
export async function sendEmail({
  to,
  subject,
  react,
}: SendEmailParams): Promise<SendEmailResult> {
  try {
    // Step 1: Get Resend client
    const resend = getResendClient();
    if (!resend) {
      logError("email", "No RESEND_API_KEY configured, skipping");
      return { success: false, error: "No API key" };
    }

    // Step 2: Parse EMAIL_ALLOWLIST
    const allowlistRaw = process.env.EMAIL_ALLOWLIST ?? "";
    const recipientLower = to.toLowerCase().trim();

    if (allowlistRaw.trim() !== "*") {
      const allowedEmails = allowlistRaw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      // Step 3: Check if recipient is allowed
      if (!allowedEmails.includes(recipientLower)) {
        logError("email", `Skipping email (not in allowlist)`);
        return { success: true };
      }
    }

    // Step 4: Send the email
    const from =
      process.env.EMAIL_FROM || "Sports Tower <noreply@alternapick.com>";

    await resend.emails.send({
      from,
      to,
      subject,
      react,
    });

    return { success: true };
  } catch (err) {
    // Step 5: Catch all errors
    const message = err instanceof Error ? err.message : String(err);
    logError("email", `sendEmail failed: ${message}`);
    return { success: false, error: message };
  }
}
