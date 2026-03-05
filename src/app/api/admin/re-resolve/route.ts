import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { handleApiError } from "@/lib/api/errors";
import { reResolveStaleCards } from "@/lib/cards/resolution";

/**
 * POST /api/admin/re-resolve
 *
 * Triggers re-resolution of stale picks (pending/incorrect results on resolved cards).
 * This handles picks that were left pending when their card was force-resolved,
 * or picks that were incorrectly classified (e.g., false DNP from transient data).
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const result = await reResolveStaleCards();

    return NextResponse.json({
      picksUpdated: result.picksUpdated,
      cardsRescored: result.cardsRescored,
      totalStale: result.totalStale,
      logs: result.logs,
      skipped: result.skipped,
    });
  } catch (err) {
    return handleApiError(err, "Failed to re-resolve stale picks");
  }
}
