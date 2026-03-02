import type { ReactElement } from "react";
import { getResendClient } from "./client";

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
      console.log("sendEmail: No RESEND_API_KEY configured, skipping");
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
        console.log(`Skipping email to ${to} (not in allowlist)`);
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
    console.error(`sendEmail error: ${message}`);
    return { success: false, error: message };
  }
}
