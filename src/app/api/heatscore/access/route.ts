import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFlag } from "@/lib/feature-flags";
import { handleApiError } from "@/lib/api/errors";

/**
 * GET /api/heatscore/access
 *
 * Returns { enabled: boolean } indicating whether the authenticated user
 * has access to Wager Flame. Two flags, independent of each other:
 *
 *   1. `heatscore_allowlist` — comma-separated emails that ALWAYS have
 *      access regardless of the global toggle. Use this to whitelist
 *      yourself or beta testers while the feature is still off for
 *      everyone else.
 *   2. `heatscore_enabled` — global toggle. When ON, ALL authenticated
 *      users have access (the allowlist is irrelevant). When OFF, only
 *      allowlisted users see Wager Flame.
 *
 * Priority: allowlist is checked first. If the user is on it, they're in
 * regardless of the global toggle. If not, the global toggle decides.
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

    const userEmail = (user.email ?? "").toLowerCase();

    // Check allowlist first — overrides the global toggle.
    // This lets you whitelist yourself while the feature is off for everyone.
    const allowlistFlag = await getFlag("heatscore_allowlist");
    if (allowlistFlag?.enabled) {
      const allowlistValue = allowlistFlag.value ?? "";
      const allowedEmails = allowlistValue
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (allowedEmails.includes(userEmail)) {
        return NextResponse.json(
          { enabled: true },
          { headers: { "Cache-Control": "private, max-age=60" } },
        );
      }
    }

    // Global toggle — when ON, everyone has access
    const enabledFlag = await getFlag("heatscore_enabled");
    const enabled = enabledFlag?.enabled === true;

    return NextResponse.json(
      { enabled },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (error) {
    return handleApiError(error, "Failed to check heatscore access");
  }
}
