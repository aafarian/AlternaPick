import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
