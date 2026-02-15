import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardDetail from "@/components/cards/CardDetail";
import type { CardWithPicks } from "@/lib/cards/api";

const CARD_SELECT = "id, user_id, status, score, total_picks, locked_at, resolved_at, created_at, challenge_id, picks(id, card_id, prop_id, selection, result, actual_value, created_at, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(sport)))";

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
    .eq("user_id", user.id)
    .single();

  if (!data) {
    redirect("/picks");
  }

  const card = data as CardWithPicks;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      <CardDetail card={card} />
    </div>
  );
}
