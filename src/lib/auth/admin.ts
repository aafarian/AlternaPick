import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getFlagValue } from "@/lib/feature-flags";

/**
 * Parse a comma-separated email string into a normalized lowercase set.
 */
function parseEmails(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check whether the given email is in the admin list.
 *
 * Fast path: checks ADMIN_EMAILS env var first to avoid a DB round-trip
 * in middleware (important for serverless cold starts). Falls through to
 * the feature flag (DB-first with env var fallback) when the env var
 * doesn't contain the email, so admins added via the UI are still recognized.
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  const normalized = email.toLowerCase();

  // Fast path: check env var directly (avoids DB query in middleware)
  const envAdmins = parseEmails(process.env.ADMIN_EMAILS);
  if (envAdmins.includes(normalized)) return true;

  // Full check: consult feature flag (DB-first, env var fallback)
  const raw = await getFlagValue("admin_emails");
  const flagAdmins = parseEmails(raw);
  return flagAdmins.includes(normalized);
}

/**
 * Async server-side check: resolves the current user from cookies
 * and determines whether they are an admin.
 */
export async function isAdmin(): Promise<{
  isAdmin: boolean;
  user: User | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, user: null };
  }

  return { isAdmin: await isAdminEmail(user.email ?? ""), user };
}

/**
 * Guard helper for API routes / server components.
 * Returns a 404 NextResponse if the caller is not an admin,
 * so that the admin surface is not discoverable by non-admins.
 */
export async function requireAdmin(): Promise<
  | { isAdmin: true; user: User }
  | { isAdmin: false; response: import("next/server").NextResponse }
> {
  const result = await isAdmin();

  if (!result.isAdmin || !result.user) {
    const { notFound } = await import("@/lib/api/errors");
    return { isAdmin: false, response: notFound("Page") };
  }

  return { isAdmin: true, user: result.user };
}
