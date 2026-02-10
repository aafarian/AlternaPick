import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CardWithPicks } from "@/lib/cards/api";
import LiveTracker from "@/components/live/LiveTracker";

async function getLockedCards(): Promise<CardWithPicks[]> {
  const supabase = await createClient();

  const result = await (supabase.from("cards") as any)
    .select("*, picks(*, props(player_name, player_id, stat_category, line, game_id))")
    .eq("status", "locked")
    .order("created_at", { ascending: false });

  return (result.data ?? []) as CardWithPicks[];
}

export default async function LivePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/live");
  }

  const cards = await getLockedCards();

  return (
    <div className="flex flex-col gap-6 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Live Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Watch your picks play out in real-time
        </p>
      </div>
      <LiveTracker initialCards={cards} />
    </div>
  );
}
