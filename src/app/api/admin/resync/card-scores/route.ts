import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { handleApiError } from "@/lib/api/errors";
import { resyncCardScores } from "@/lib/admin/resync";

/**
 * POST /api/admin/resync/card-scores
 *
 * Recalculates score/total_picks for all resolved cards from actual pick results.
 */
export async function POST() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const result = await resyncCardScores();

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "Failed to resync card scores");
  }
}
