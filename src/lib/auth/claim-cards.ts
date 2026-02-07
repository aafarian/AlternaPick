import { createAdminClient } from "@/lib/supabase/admin";

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
    console.error("Failed to claim anonymous cards:", error.message);
    return 0;
  }

  return data?.length ?? 0;
}
