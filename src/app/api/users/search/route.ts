import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import type { Profile, Friendship } from "@/lib/supabase/types";

type FriendshipStatusLabel =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "friends";

interface UserSearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
  friendship_status: FriendshipStatusLabel;
}

/**
 * GET /api/users/search?q=username
 * Search for users by username (case-insensitive partial match).
 * Returns top 10 matching profiles with friendship status relative to the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";

    // Empty or too-short query returns empty results
    if (query.length < 2) {
      return NextResponse.json({ users: [] });
    }

    // Search profiles by username (case-insensitive partial match), excluding current user
    const { data: profiles, error: searchError } = await (
      supabase.from("profiles") as any
    )
      .select("id, username, display_name, avatar_url, icon_config")
      .ilike("username", `%${query}%`)
      .neq("id", user.id)
      .limit(10);

    if (searchError) {
      throw new Error(searchError.message);
    }

    const matchedProfiles = (profiles ?? []) as Pick<
      Profile,
      "id" | "username" | "display_name" | "avatar_url" | "icon_config"
    >[];

    if (matchedProfiles.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Collect all matched user IDs to batch-query friendships
    const matchedIds = matchedProfiles.map((p) => p.id);

    // Query friendships where the current user is the requester and the other is in matchedIds
    const { data: sentRows, error: sentErr } = await (
      supabase.from("friendships") as any
    )
      .select("id, requester_id, addressee_id, status")
      .eq("requester_id", user.id)
      .in("addressee_id", matchedIds);

    if (sentErr) throw new Error(sentErr.message);

    // Query friendships where the current user is the addressee and the other is in matchedIds
    const { data: receivedRows, error: recvErr } = await (
      supabase.from("friendships") as any
    )
      .select("id, requester_id, addressee_id, status")
      .eq("addressee_id", user.id)
      .in("requester_id", matchedIds);

    if (recvErr) throw new Error(recvErr.message);

    // Build a map: otherUserId -> friendship status label
    const statusMap = new Map<string, FriendshipStatusLabel>();

    for (const row of (sentRows ?? []) as Friendship[]) {
      if (row.status === "accepted") {
        statusMap.set(row.addressee_id, "friends");
      } else if (row.status === "pending") {
        statusMap.set(row.addressee_id, "pending_sent");
      }
      // "blocked" is ignored for search display
    }

    for (const row of (receivedRows ?? []) as Friendship[]) {
      if (row.status === "accepted") {
        statusMap.set(row.requester_id, "friends");
      } else if (row.status === "pending") {
        statusMap.set(row.requester_id, "pending_received");
      }
    }

    // Build response
    const users: UserSearchResult[] = matchedProfiles.map((p) => ({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      icon_config: p.icon_config,
      friendship_status: statusMap.get(p.id) ?? "none",
    }));

    return NextResponse.json({ users });
  } catch (error) {
    return handleApiError(error, "Failed to search users");
  }
}
