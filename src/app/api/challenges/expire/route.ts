import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import { expireStaleChallenges } from "@/lib/challenges/queries";
import { resolveEligibleCards } from "@/lib/cards/resolution";
import { resolveEligibleChallenges } from "@/lib/challenges/resolution";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const result = await expireStaleChallenges(admin as any);

    // Safety net: attempt card + challenge resolution on every expire cycle.
    // These are idempotent — they query for eligible items and skip if nothing qualifies.
    let cardsResolved = 0;
    let challengesResolved = 0;
    try {
      const cardResults = await resolveEligibleCards();
      cardsResolved = cardResults.length;

      const challengeResults = await resolveEligibleChallenges();
      challengesResolved = challengeResults.length;
    } catch (resolveError) {
      console.error("Resolution in expire cycle failed:", resolveError);
    }

    return NextResponse.json({
      ok: true,
      expired: result.expired,
      converted: result.converted,
      cards_resolved: cardsResolved,
      challenges_resolved: challengesResolved,
    });
  } catch (error) {
    return handleApiError(error, "Failed to expire challenges");
  }
}
