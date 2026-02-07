import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { claimAnonymousCards } from "@/lib/auth/claim-cards";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/cards";

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

  // Claim anonymous cards if the user had a local session
  const anonId = request.cookies.get("st_anon_id")?.value;
  if (anonId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await claimAnonymousCards(user.id, anonId);
    }
  }

  const response = NextResponse.redirect(`${origin}${next}`);
  // Clear the anonymous cookie now that cards are claimed
  if (anonId) {
    response.cookies.delete("st_anon_id");
  }
  return response;
}
