import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, badRequest, handleApiError } from "@/lib/api/errors";
import {
  getReactionsForTarget,
  getReactionCounts,
} from "@/lib/reactions/queries";
import type { ReactionTargetType } from "@/lib/supabase/types";

const VALID_TARGET_TYPES: ReactionTargetType[] = ["challenge", "card"];

/**
 * GET /api/reactions/[targetType]/[targetId]
 * Returns reactions with user info and aggregated emoji counts for a target.
 *
 * Auth required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ targetType: string; targetId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { targetType, targetId } = await params;

    if (!VALID_TARGET_TYPES.includes(targetType as ReactionTargetType)) {
      return badRequest(
        `Invalid target_type: ${targetType}. Must be "challenge" or "card".`
      );
    }

    const validTargetType = targetType as ReactionTargetType;

    const [reactions, counts] = await Promise.all([
      getReactionsForTarget(supabase, validTargetType, targetId),
      getReactionCounts(supabase, validTargetType, targetId),
    ]);

    return NextResponse.json({ reactions, counts });
  } catch (error) {
    return handleApiError(error, "Failed to fetch reactions");
  }
}
