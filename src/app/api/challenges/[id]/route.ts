import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import type { Challenge } from "@/lib/supabase/types";
import {
  getChallenge,
  respondToChallenge,
  ChallengeValidationError,
  ChallengeNotFoundError,
} from "@/lib/challenges/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const challenge = await getChallenge(supabase, id, user.id);

    if (!challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch challenge", message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    const body = (await request.json()) as { action?: string };

    if (!body.action) {
      return NextResponse.json(
        { error: "action is required (accept, decline, or cancel)" },
        { status: 400 }
      );
    }

    const validActions = ["accept", "decline", "cancel"];
    if (!validActions.includes(body.action)) {
      return NextResponse.json(
        { error: `Invalid action: ${body.action}. Must be accept, decline, or cancel` },
        { status: 400 }
      );
    }

    const challenge = await respondToChallenge(
      supabase,
      id,
      user.id,
      body.action as "accept" | "decline" | "cancel"
    );

    // Fire-and-forget: notify challenger when opponent accepts
    if (body.action === "accept") {
      try {
        const adminClient = createAdminClient();
        const ch = challenge as Challenge;
        const { data: opponentProfile } = await (
          adminClient.from("profiles") as any
        )
          .select("username")
          .eq("id", user.id)
          .single();
        const opponentName =
          (opponentProfile as { username: string } | null)?.username ?? "Someone";
        await createNotification(adminClient, {
          user_id: ch.challenger_id,
          type: "challenge_accepted",
          title: "Challenge Accepted",
          body: `${opponentName} accepted your challenge!`,
          metadata: { challenge_id: ch.id },
        });
      } catch (notifError) {
        console.error("Failed to create challenge_accepted notification:", notifError);
      }
    }

    return NextResponse.json({ challenge });
  } catch (error) {
    if (error instanceof ChallengeNotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof ChallengeValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update challenge", message },
      { status: 500 }
    );
  }
}
