import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, handleApiError } from "@/lib/api/errors";

/**
 * GET /api/users/check-username?username=foo
 *
 * Checks whether a username is valid and available.
 * No auth required (used during the post-signup setup flow).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();

    if (!username) {
      return badRequest("username query parameter is required");
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return NextResponse.json({ available: false, error: "Invalid format" });
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();

    return NextResponse.json({ available: !existing });
  } catch (error) {
    return handleApiError(error, "Failed to check username");
  }
}
