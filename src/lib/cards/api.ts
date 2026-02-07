import type { PickSelection, CardStatus } from "@/lib/supabase/types";

export interface CardWithPicks {
  id: string;
  user_id: string | null;
  status: CardStatus;
  score: number;
  total_picks: number;
  locked_at: string | null;
  resolved_at: string | null;
  created_at: string;
  picks: {
    id: string;
    card_id: string;
    prop_id: string;
    selection: PickSelection;
    result: "pending" | "hit" | "miss";
    actual_value: number | null;
    created_at: string;
    props?: {
      player_name: string;
      stat_category: string;
      line: number;
      game_id: string;
    };
  }[];
}

export async function createCard(
  picks: { prop_id: string; selection: PickSelection }[],
  anonId?: string
): Promise<CardWithPicks> {
  const response = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ picks, anon_id: anonId }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to create card: ${response.status}`);
  }

  const data = await response.json();
  return data.card;
}

export async function getCards(params?: {
  status?: CardStatus;
  limit?: number;
  offset?: number;
}): Promise<CardWithPicks[]> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.offset) searchParams.set("offset", String(params.offset));

  const qs = searchParams.toString();
  const response = await fetch(`/api/cards${qs ? `?${qs}` : ""}`);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Failed to fetch cards: ${response.status}`);
  }

  const data = await response.json();
  return data.cards;
}
