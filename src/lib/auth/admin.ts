import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getFlagValue } from "@/lib/feature-flags";

/**
 * Check whether the given email is in the admin list.
 *
 * Reads admin emails from the `admin_emails` feature flag (with env var
 * fallback handled by `getFlagValue`). Fails closed: if the flag is
 * missing or empty, no email is considered admin.
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  const raw = await getFlagValue("admin_emails");
  const adminEmails = (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
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
