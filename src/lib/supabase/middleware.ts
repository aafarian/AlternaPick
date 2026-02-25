import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";

/** Throttle last_active_at updates: only write once per 5 minutes per user. */
const ACTIVE_THROTTLE_MS = 5 * 60 * 1000;
const MAX_THROTTLE_MAP_SIZE = 10_000;
const recentlyActive = new Map<string, number>();

export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Track last visit for DAU metrics (throttled to avoid excessive writes)
  if (user) {
    const now = Date.now();

    // Prune stale entries to prevent unbounded growth on long-lived processes
    if (recentlyActive.size > MAX_THROTTLE_MAP_SIZE) {
      const cutoff = now - ACTIVE_THROTTLE_MS;
      for (const [id, ts] of recentlyActive) {
        if (ts < cutoff) recentlyActive.delete(id);
      }
    }

    const lastSeen = recentlyActive.get(user.id) ?? 0;
    if (now - lastSeen > ACTIVE_THROTTLE_MS) {
      recentlyActive.set(user.id, now);
      supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id)
        .then(({ error }) => {
          if (error) logError("DAU", `last_active_at update failed: ${error.message}`);
        });
    }
  }

  return { response: supabaseResponse, user };
}
