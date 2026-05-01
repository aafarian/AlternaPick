import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFlag } from "@/lib/feature-flags";
import { handleApiError } from "@/lib/api/errors";

/**
 * GET /api/heatscore/access
 *
 * Returns { enabled: boolean } indicating whether the authenticated user
 * has access to Heat Mode. Checks two feature flags:
 *
 *   1. `heatscore_enabled` — global toggle. If disabled, Heat Mode is off
 *      for everyone.
 *   2. `heatscore_allowlist` — comma-separated list of emails that can
 *      access Heat Mode when enabled. If the value is `*`, all users have
 *      access. If a specific list, only those emails are allowed.
 *
 * Unauthenticated requests return { enabled: false }.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ enabled: false });
    }

    // Global gate
    const enabledFlag = await getFlag("heatscore_enabled");
    if (!enabledFlag?.enabled) {
      return NextResponse.json({ enabled: false });
    }

    // Per-user allowlist
    const allowlistFlag = await getFlag("heatscore_allowlist");
    const allowlistValue = allowlistFlag?.enabled ? (allowlistFlag.value ?? "") : "";

    if (allowlistValue.trim() === "*") {
      return NextResponse.json({ enabled: true });
    }

    const allowedEmails = allowlistValue
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const userEmail = (user.email ?? "").toLowerCase();
    const enabled = allowedEmails.includes(userEmail);

    return NextResponse.json(
      { enabled },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    return handleApiError(error, "Failed to check heatscore access");
  }
}
