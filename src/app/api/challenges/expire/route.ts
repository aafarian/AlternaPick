import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import { expireStaleChallenges } from "@/lib/challenges/queries";
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

    return NextResponse.json({
      ok: true,
      expired: result.expired,
      converted: result.converted,
    });
  } catch (error) {
    return handleApiError(error, "Failed to expire challenges");
  }
}
