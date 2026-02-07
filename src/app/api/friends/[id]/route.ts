import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Friendship } from "@/lib/supabase/types";
import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  ValidationError,
  NotFoundError,
} from "@/lib/friends/queries";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/friends/[id]
 * Get a single friendship's details.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const { data: friendship, error } = await (
      supabase.from("friendships") as any
    )
      .select("*")
      .eq("id", id)
      .single();

    if (error || !friendship) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    const row = friendship as Friendship;

    // Only participants can view
    if (row.requester_id !== user.id && row.addressee_id !== user.id) {
      return NextResponse.json(
        { error: "Friendship not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ friendship: row });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch friendship", message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/friends/[id]
 * Accept or decline a friend request.
 * Body: { action: "accept" | "decline" }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    const body = (await request.json()) as { action?: string };

    if (body.action !== "accept" && body.action !== "decline") {
      return NextResponse.json(
        { error: 'action must be "accept" or "decline"' },
        { status: 400 }
      );
    }

    if (body.action === "accept") {
      const updated = await acceptFriendRequest(supabase, id, user.id);
      return NextResponse.json({ friendship: updated });
    }

    // Decline: deletes the row
    await declineFriendRequest(supabase, id, user.id);
    return NextResponse.json({ message: "Friend request declined" });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to update friendship", message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/friends/[id]
 * Unfriend - either party can delete.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
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

    await removeFriend(supabase, id, user.id);
    return NextResponse.json({ message: "Friend removed" });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to remove friend", message },
      { status: 500 }
    );
  }
}
