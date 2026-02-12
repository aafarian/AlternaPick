import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processReferral } from "@/lib/referrals/queries";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";

/**
 * POST /api/referrals/process
 *
 * Processes a referral for a newly signed-up user.
 * Requires authentication (new user must be logged in).
 *
 * Body: { referrer_username: string }
 *
 * - Sets referred_by on new user's profile
 * - Creates an accepted friendship
 * - Awards referrer a streak freeze
 * - Triggers "Recruiter" achievement check
 *
 * Returns 200 on success, 400 if already referred or referrer not found.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const body = (await request.json()) as {
      referrer_username?: string;
    };

    if (
      !body.referrer_username ||
      typeof body.referrer_username !== "string"
    ) {
      return badRequest("referrer_username is required");
    }

    const referrerUsername = body.referrer_username.trim();

    if (!referrerUsername) {
      return badRequest("referrer_username cannot be empty");
    }

    await processReferral(supabase, user.id, referrerUsername);

    return NextResponse.json({ success: true });
  } catch (error) {
    // processReferral throws descriptive errors for:
    // - "Referrer not found"
    // - "Failed to set referred_by"
    // etc.
    if (
      error instanceof Error &&
      error.message.includes("not found")
    ) {
      return badRequest(error.message);
    }

    return handleApiError(error, "Failed to process referral");
  }
}
