import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getFriends,
  getPendingRequests,
  sendFriendRequest,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/lib/friends/queries";

/**
 * GET /api/friends
 * Returns the authenticated user's friends list and pending requests.
 * Query params: ?status=accepted|pending (default: accepted)
 */
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
    const status = searchParams.get("status") ?? "accepted";

    if (status === "pending") {
      const requests = await getPendingRequests(supabase, user.id);
      return NextResponse.json({ friends: requests });
    }

    const friends = await getFriends(supabase, user.id);
    return NextResponse.json({ friends });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch friends", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/friends
 * Send a friend request.
 * Body: { addressee_username: string }
 */
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

    const body = (await request.json()) as { addressee_username?: string };

    if (!body.addressee_username || typeof body.addressee_username !== "string") {
      return NextResponse.json(
        { error: "addressee_username is required" },
        { status: 400 }
      );
    }

    const friendship = await sendFriendRequest(
      supabase,
      user.id,
      body.addressee_username.trim()
    );

    return NextResponse.json({ friendship }, { status: 201 });
  } catch (error) {
    if (
      error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof ConflictError
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to send friend request", message },
      { status: 500 }
    );
  }
}
