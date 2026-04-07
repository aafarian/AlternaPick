import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARD_SELECT, type CardWithPicks } from "@/lib/cards/api";
import { CardModal } from "./CardModal";

/**
 * Intercepting route: when the user clicks a card link from /picks, this
 * page is rendered in the @modal parallel slot. The /picks list stays
 * mounted underneath, so scroll position and pagination state are preserved.
 *
 * Direct navigation to /cards/[id] (refresh, share link, deep link from
 * elsewhere) still hits the standalone src/app/cards/[id]/page.tsx — this
 * intercepting route only fires for soft client-side navigation from /picks.
 */
export default async function InterceptedCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Use admin client to bypass RLS so any user can view any card
  // (matches the behavior of the standalone /cards/[id] page).
  const admin = createAdminClient();
  const { data } = await (admin.from("cards") as any)
    .select(CARD_SELECT)
    .eq("id", id)
    .single();

  if (!data) {
    notFound();
  }

  return <CardModal card={data as CardWithPicks} />;
}
