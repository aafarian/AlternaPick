import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardDetail from "@/components/cards/CardDetail";
import { CARD_SELECT, type CardWithPicks } from "@/lib/cards/api";
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

  const { data } = await (supabase.from("cards") as any)
    .select(CARD_SELECT)
    .eq("id", id)
    .single();

  if (!data) {
    redirect("/picks");
  }

  const card = data as CardWithPicks;

  return (
    <FadeIn>
      <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
        <CardDetail card={card} linked={false} />
      </div>
    </FadeIn>
  );
}
