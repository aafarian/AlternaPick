import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/queries";
import type { ChallengeStatus } from "@/lib/supabase/types";
import {
  getChallenges,
  createChallenge,
  ChallengeValidationError,
} from "@/lib/challenges/queries";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    let statusFilter: ChallengeStatus[] | undefined;
    if (statusParam) {
      statusFilter = statusParam.split(",").map((s) => s.trim()) as ChallengeStatus[];
      const validStatuses: ChallengeStatus[] = [
        "pending",
        "accepted",
        "declined",
        "active",
        "resolved",
        "cancelled",
      ];
      for (const s of statusFilter) {
        if (!validStatuses.includes(s)) {
          return NextResponse.json(
            { error: `Invalid status filter: ${s}` },
            { status: 400 }
          );
        }
      }
    }

    const challenges = await getChallenges(supabase, user.id, statusFilter);

    return NextResponse.json({ challenges });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch challenges", message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = (await request.json()) as { opponent_id?: string };

    if (!body.opponent_id) {
      return NextResponse.json(
        { error: "opponent_id is required" },
        { status: 400 }
      );
    }

    const challenge = await createChallenge(
      supabase,
      user.id,
      body.opponent_id
    );

    // Fire-and-forget: notify opponent about the challenge
    try {
      const adminClient = createAdminClient();
      const { data: challengerProfile } = await (
        adminClient.from("profiles") as any
      )
        .select("username")
        .eq("id", user.id)
        .single();
      const challengerName =
        (challengerProfile as { username: string } | null)?.username ?? "Someone";
      await createNotification(adminClient, {
        user_id: body.opponent_id,
        type: "challenge_received",
        title: "New Challenge",
        body: `You received a challenge from ${challengerName}!`,
        metadata: { challenge_id: challenge.id },
      });
    } catch (notifError) {
      console.error("Failed to create challenge_received notification:", notifError);
    }

    return NextResponse.json({ challenge }, { status: 201 });
  } catch (error) {
    if (error instanceof ChallengeValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to create challenge", message },
      { status: 500 }
    );
  }
}
