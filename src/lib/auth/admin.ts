import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Comma-separated list of admin emails.
 * Set via ADMIN_EMAILS in .env.local / deploy secrets.
 * Fails closed (no admins) if the env var is missing.
 */
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Synchronous check: is the given email in the admin list?
 * Useful in middleware where the user is already resolved.
 */
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
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

  return { isAdmin: isAdminEmail(user.email ?? ""), user };
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
