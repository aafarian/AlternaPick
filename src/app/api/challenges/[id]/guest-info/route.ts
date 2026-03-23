import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyGuestToken } from "@/lib/challenges/guest-token";
import { badRequest, handleApiError } from "@/lib/api/errors";
import { logWarn } from "@/lib/logger";
import type { Challenge } from "@/lib/supabase/types";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/challenges/[id]/guest-info?token=xxx
 *
 * Returns minimal challenge context for the guest props-browsing flow.
 * Authenticated via guest token — no login required.
 */
export async function GET(
  request: NextRequest,
  context: RouteContext,
) {
  try {
    const { id: challengeId } = await context.params;
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return badRequest("Token is required");
    }

    const tokenData = await verifyGuestToken(token);
    if (!tokenData) {
      logWarn("guest-info", "Invalid or expired guest token");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    if (tokenData.challengeId !== challengeId) {
      logWarn("guest-info", "Token challenge_id mismatch");
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    const { data: challengeData, error: challengeError } = await (
      admin.from("challenges") as any
    )
      .select(
        "id, game_mode, card_size, status, challenger:profiles!challenges_challenger_id_fkey(username)"
      )
      .eq("id", challengeId)
      .single();

    if (challengeError || !challengeData) {
      return badRequest("Challenge not found");
    }

    const challenge = challengeData as Challenge & {
      challenger: { username: string };
    };

    return NextResponse.json({
      challenge: {
        id: challenge.id,
        game_mode: challenge.game_mode,
        card_size: challenge.card_size,
        status: challenge.status,
        challenger_name: challenge.challenger.username,
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch guest challenge info");
  }
}
