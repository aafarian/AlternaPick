import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { unauthorized, handleApiError } from "@/lib/api/errors";

/**
 * GET /api/friends/suggested
 * Returns a list of suggested users to add as friends.
 * The developer account is always first, followed by random active users.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return unauthorized();

    const admin = createAdminClient();

    // Get the developer's profile (always first in suggestions)
    const devUsername = "antoafarian";

    // Get existing friend IDs to exclude from suggestions
    const { data: friendships } = await (admin.from("friendships") as any)
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

    const friendIds = new Set<string>([user.id]);
    for (const f of friendships ?? []) {
      friendIds.add(f.requester_id);
      friendIds.add(f.addressee_id);
    }

    // Fetch developer profile
    const { data: devProfile } = await (admin.from("profiles") as any)
      .select("id, username, display_name, avatar_url, icon_config")
      .eq("username", devUsername)
      .single();

    // Fetch random active users (have locked at least 1 card)
    const { data: activeUsers } = await (admin.from("profiles") as any)
      .select("id, username, display_name, avatar_url, icon_config")
      .neq("id", user.id)
      .not("username", "is", null)
      .order("last_active_at", { ascending: false, nullsFirst: false })
      .limit(20);

    const suggestions: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      icon_config: Record<string, unknown> | null;
      label: string | null;
    }[] = [];

    // Add developer first (if not already a friend)
    if (devProfile && !friendIds.has(devProfile.id)) {
      suggestions.push({ ...devProfile, label: "Developer" });
    }

    // Add random active users (exclude friends and developer)
    const devId = devProfile?.id;
    for (const u of activeUsers ?? []) {
      if (friendIds.has(u.id)) continue;
      if (u.id === devId) continue;
      if (suggestions.length >= 6) break;
      suggestions.push({ ...u, label: null });
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleApiError(error, "Failed to fetch suggested friends");
  }
}
