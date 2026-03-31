import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/logger";

export async function claimAnonymousCards(
  userId: string,
  anonId: string
): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await (supabase.from("cards") as any)
    .update({ user_id: userId, anon_id: null })
    .eq("anon_id", anonId)
    .is("user_id", null)
    .select("id");

  if (error) {
    logError("claim-cards", "Failed to claim anonymous cards", undefined, error);
    return 0;
  }

  return data?.length ?? 0;
}
