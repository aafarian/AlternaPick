import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/email/unsubscribe-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { logError, logInfo } from "@/lib/logger";
import type { NotificationPreferences } from "@/lib/supabase/types";

/**
 * RFC 8058 one-click unsubscribe endpoint.
 *
 * POST — called by email clients (Gmail, Outlook) for one-click unsubscribe.
 * GET  — called when users click the unsubscribe link in the email footer;
 *        renders a simple confirmation page.
 */

async function disableEmailsForUser(email: string): Promise<boolean> {
  const admin = createAdminClient();

  // Use ilike for case-insensitive match — the unsubscribe token normalises
  // the email to lowercase, but the profile may store mixed case.
  const { data: profile } = await typedFrom(admin, "profiles")
    .select("id, notification_preferences")
    .ilike("email", email)
    .limit(1)
    .single();

  if (!profile) return false;

  const prefs = ((profile.notification_preferences ?? {}) as NotificationPreferences);
  const updated: NotificationPreferences = {
    ...prefs,
    email_card_resolved: false,
    email_challenge_received: false,
    email_challenge_resolved: false,
    email_friend_request: false,
  };

  const { error } = await typedFrom(admin, "profiles")
    .update({ notification_preferences: updated })
    .eq("id", profile.id);

  if (error) {
    logError("email", "Failed to update preferences for unsubscribe", "/api/email/unsubscribe", error);
    return false;
  }

  logInfo("email", `User unsubscribed via email: ${email}`);
  return true;
}

/**
 * POST — one-click unsubscribe.
 *
 * Called by:
 * 1. Email clients via RFC 8058 (List-Unsubscribe-Post header) — expects JSON.
 * 2. The browser confirmation form — expects redirect.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  const success = await disableEmailsForUser(email);
  if (!success) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Browser form submission — redirect to confirmation page
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("form")) {
    return NextResponse.redirect(
      new URL(`/api/email/unsubscribe?token=${encodeURIComponent(token)}&done=1`, request.url),
    );
  }

  // RFC 8058 / API call — return JSON
  return NextResponse.json({ ok: true });
}

/**
 * GET — browser-based unsubscribe page.
 *
 * Shows a confirmation page with a button that POSTs. Does NOT auto-unsubscribe
 * on GET because link previewers (Slack, iMessage, SafeLinks) crawl GET URLs
 * and would silently unsubscribe users.
 *
 * When the form is submitted (POST with action= pointing back here), the POST
 * handler above processes the actual unsubscribe.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const done = url.searchParams.get("done");

  if (!token) {
    return htmlResponse(400, renderPage("Invalid link", "This unsubscribe link is invalid or expired."));
  }

  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return htmlResponse(400, renderPage("Invalid link", "This unsubscribe link is invalid or expired."));
  }

  // After POST redirect — show success message
  if (done === "1") {
    return htmlResponse(200, renderPage(
      "Unsubscribed",
      "You've been unsubscribed from AlternaPick emails. You can re-enable notifications in your account settings.",
    ));
  }

  // Show confirmation page with form
  return htmlResponse(200, renderConfirmPage(token));
}

function htmlResponse(status: number, html: string): NextResponse {
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const pageStyle = `
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 24px; color: #3f3f46; }
  h1 { font-size: 20px; color: #09090b; margin-bottom: 12px; }
  p { font-size: 15px; line-height: 1.6; }
  button { background: #09090b; color: #fff; border: none; padding: 12px 28px; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
`;

function renderPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — AlternaPick</title>
  <style>${pageStyle}</style>
</head>
<body>
  <h1>${title}</h1>
  <p>${body}</p>
</body>
</html>`;
}

function renderConfirmPage(token: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Unsubscribe — AlternaPick</title>
  <style>${pageStyle}</style>
</head>
<body>
  <h1>Unsubscribe</h1>
  <p>Click the button below to unsubscribe from all AlternaPick emails.</p>
  <form method="POST" action="/api/email/unsubscribe?token=${encodeURIComponent(token)}">
    <button type="submit">Unsubscribe</button>
  </form>
</body>
</html>`;
}

