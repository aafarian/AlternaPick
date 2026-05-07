import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import CardDetail from "@/components/cards/CardDetail";
import BackButton from "@/components/ui/BackButton";
import { CARD_SELECT, type CardWithPicks } from "@/lib/cards/api";
import { getCategoryStats } from "@/lib/analytics/queries";
import { FadeIn } from "@/components/motion";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Use admin client to bypass RLS so any user can view any card
  const admin = createAdminClient();
  const { data } = await (admin.from("cards") as any)
    .select(CARD_SELECT)
    .eq("id", id)
    .single();

  if (!data) {
    redirect("/picks");
  }

  const card = data as CardWithPicks;

  // Fetch category stats for the side panel
  let categoryStats: Map<string, { rate: number; total: number }> | undefined;
  try {
    const stats = await getCategoryStats(supabase, user.id);
    categoryStats = new Map(stats.map((s) => [s.category, { rate: s.rate, total: s.total }]));
  } catch {
    // Non-blocking — side panel just won't show
  }

  return (
    <FadeIn>
      <div className="mx-auto flex max-w-4xl flex-col gap-8 py-8">
        <BackButton />
        <CardDetail card={card} linked={false} categoryStats={categoryStats} />
      </div>
    </FadeIn>
  );
}
