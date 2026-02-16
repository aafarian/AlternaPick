import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";

/**
 * Get the set of accepted friend user IDs for a given user.
 * Queries both directions of the friendships table.
 */
export async function getFriendIds(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<string[]> {
  const { data: asRequester, error: err1 } = await typedFrom(
    supabase,
    "friendships"
  )
    .select("addressee_id")
    .eq("requester_id", userId)
    .eq("status", "accepted");

  if (err1) throw new Error(err1.message);

  const { data: asAddressee, error: err2 } = await typedFrom(
    supabase,
    "friendships"
  )
    .select("requester_id")
    .eq("addressee_id", userId)
    .eq("status", "accepted");

  if (err2) throw new Error(err2.message);

  const ids = new Set<string>();
  for (const row of (asRequester ?? []) as Array<{ addressee_id: string }>) {
    ids.add(row.addressee_id);
  }
  for (const row of (asAddressee ?? []) as Array<{ requester_id: string }>) {
    ids.add(row.requester_id);
  }

  return Array.from(ids);
}
