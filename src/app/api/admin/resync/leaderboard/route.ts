import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { handleApiError } from "@/lib/api/errors";
import {
  rebuildUserLeaderboard,
  rebuildAllLeaderboards,
} from "@/lib/admin/resync";

/**
 * POST /api/admin/resync/leaderboard
 *
 * Rebuilds leaderboard stats. Pass { userId } to rebuild a single user,
 * or omit to rebuild all users.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) return auth.response;

    const body = await request.json().catch(() => ({}));
    const { userId } = body as { userId?: string };

    if (userId) {
      const result = await rebuildUserLeaderboard(userId);
      return NextResponse.json(result);
    }

    const result = await rebuildAllLeaderboards();
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "Failed to rebuild leaderboard");
  }
}
