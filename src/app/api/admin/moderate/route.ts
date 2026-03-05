import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { badRequest, notFound, handleApiError } from "@/lib/api/errors";
import type {
  AdminModerationAction,
  AdminModerationActionType,
} from "@/lib/admin/types";

// ---------------------------------------------------------------------------
// Row types for query results
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  username: string;
  email: string | null;
};

type ChallengeRow = {
  id: string;
  status: string;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_ACTIONS: AdminModerationActionType[] = [
  "deactivate",
  "reactivate",
  "reset_password",
  "delete_card",
  "delete_challenge",
];

/**
 * POST /api/admin/moderate
 * Executes a moderation action on a target entity.
 *
 * Body: { action: AdminModerationActionType, targetId: string }
 *
 * Requires admin access; returns 404 for non-admin or unauthenticated users
 * so the endpoint is not discoverable.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const body = (await request.json()) as AdminModerationAction;
    const { action, targetId } = body;

    if (!action || !targetId) {
      return badRequest("Missing required fields: action, targetId");
    }

    if (!VALID_ACTIONS.includes(action)) {
      return badRequest(
        `Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(", ")}`
      );
    }

    const supabase = createAdminClient();

    switch (action) {
      case "deactivate": {
         
        const { data: profileData, error: fetchError } = await (
          supabase.from("profiles") as any
        )
          .select("id, username")
          .eq("id", targetId)
          .single();

        if (fetchError || !profileData) {
          return notFound("User");
        }

        const profile = profileData as ProfileRow;

         
        const { error: updateError } = await (
          supabase.from("profiles") as any
        )
          .update({ is_deactivated: true })
          .eq("id", targetId);

        if (updateError) {
          throw updateError;
        }

        return NextResponse.json({
          success: true,
          message: `User "${profile.username}" has been deactivated`,
        });
      }

      case "reactivate": {
         
        const { data: profileData, error: fetchError } = await (
          supabase.from("profiles") as any
        )
          .select("id, username")
          .eq("id", targetId)
          .single();

        if (fetchError || !profileData) {
          return notFound("User");
        }

        const profile = profileData as ProfileRow;

         
        const { error: updateError } = await (
          supabase.from("profiles") as any
        )
          .update({ is_deactivated: false })
          .eq("id", targetId);

        if (updateError) {
          throw updateError;
        }

        return NextResponse.json({
          success: true,
          message: `User "${profile.username}" has been reactivated`,
        });
      }

      case "reset_password": {
        // First fetch the user's email from profiles
         
        const { data: profileData, error: fetchError } = await (
          supabase.from("profiles") as any
        )
          .select("id, username, email")
          .eq("id", targetId)
          .single();

        if (fetchError || !profileData) {
          return notFound("User");
        }

        const profile = profileData as ProfileRow;

        if (!profile.email) {
          return badRequest("User does not have an email address on file");
        }

        // Use admin auth to generate a recovery link which triggers the email
        const { error: resetError } = await supabase.auth.admin.generateLink({
          type: "recovery",
          email: profile.email,
        });

        if (resetError) {
          throw resetError;
        }

        return NextResponse.json({
          success: true,
          message: `Password reset email sent to user "${profile.username}"`,
        });
      }

      case "delete_card": {
         
        const { data: cardData, error: fetchError } = await (
          supabase.from("cards") as any
        )
          .select("id")
          .eq("id", targetId)
          .single();

        if (fetchError || !cardData) {
          return notFound("Card");
        }

         
        const { error: deleteError } = await (supabase.from("cards") as any)
          .delete()
          .eq("id", targetId);

        if (deleteError) {
          throw deleteError;
        }

        return NextResponse.json({
          success: true,
          message: `Card ${targetId} and its associated picks have been deleted`,
        });
      }

      case "delete_challenge": {
         
        const { data: challengeData, error: fetchError } = await (
          supabase.from("challenges") as any
        )
          .select("id, status")
          .eq("id", targetId)
          .single();

        if (fetchError || !challengeData) {
          return notFound("Challenge");
        }

        const challenge = challengeData as ChallengeRow;

        if (challenge.status === "cancelled") {
          return badRequest("Challenge is already cancelled");
        }

         
        const { error: updateError } = await (
          supabase.from("challenges") as any
        )
          .update({ status: "cancelled" })
          .eq("id", targetId);

        if (updateError) {
          throw updateError;
        }

        return NextResponse.json({
          success: true,
          message: `Challenge ${targetId} has been cancelled`,
        });
      }

      default: {
        // Exhaustiveness check — should never reach here due to validation above
        const _exhaustive: never = action;
        return badRequest(`Unhandled action: ${_exhaustive}`);
      }
    }
  } catch (error) {
    return handleApiError(error, "Failed to execute moderation action");
  }
}
