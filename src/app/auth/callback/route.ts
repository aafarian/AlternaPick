import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimAnonymousCards } from "@/lib/auth/claim-cards";
import { processReferral } from "@/lib/referrals/queries";
import { logError } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = forwardedHost ?? request.headers.get("host");
  const origin = host
    ? `${forwardedProto}://${host}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://alternapick.com");
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/props";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_callback_failed`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Ensure profile exists for OAuth users (DB trigger may not have fired)
  if (user) {
    const admin = createAdminClient();
    const fallbackUsername = "user_" + user.id.replace(/-/g, "").slice(0, 8);

     
    const { error: profileError } = await (admin.from("profiles") as any).upsert(
      {
        id: user.id,
        username: fallbackUsername,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    if (profileError) {
      logError("auth-callback", `Profile upsert error: ${profileError.message}`);
    }

    // Ensure leaderboard entry exists
     
    const { error: leaderboardError } = await (admin.from("leaderboard_entries") as any).upsert(
      { user_id: user.id },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

    if (leaderboardError) {
      logError("auth-callback", `Leaderboard upsert error: ${leaderboardError.message}`);
    }
  }

  // Claim anonymous cards if the user had a local session
  const anonId = request.cookies.get("ap_anon_id")?.value;
  if (anonId && user) {
    await claimAnonymousCards(user.id, anonId);
  }

  // Process referral if the signup page set a referrer cookie
  const refUsername = request.cookies.get("ap_ref")?.value;
  if (refUsername && user) {
    try {
      await processReferral(supabase, user.id, decodeURIComponent(refUsername));
    } catch {
      // Non-fatal: referral failure should not block the auth flow
      logError("auth-callback", "Failed to process referral");
    }
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  // Clear consumed cookies
  if (anonId) {
    response.cookies.delete("ap_anon_id");
  }
  if (refUsername) {
    response.cookies.delete("ap_ref");
  }

  return response;
}
