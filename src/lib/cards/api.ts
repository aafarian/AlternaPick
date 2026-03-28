import type { PickSelection, CardStatus } from "@/lib/supabase/types";

/** Supabase select string for cards with picks, props, and game data.
 *  Superset of all card queries — includes card_size and game_mode. */
export const CARD_SELECT = "id, user_id, status, score, total_picks, card_size, game_mode, locked_at, resolved_at, created_at, challenge_id, challenges(challenger_id, opponent_id, opponent_email, lobby_type, max_participants, challenger:profiles!challenges_challenger_id_fkey(username), opponent:profiles!challenges_opponent_id_fkey(username)), picks(id, card_id, prop_id, selection, result, actual_value, created_at, props(player_name, player_id, player_team, player_position, stat_category, line, game_id, games(sport, home_team, away_team, home_score, away_score, commence_time, external_event_id, status)))" as const;

export interface CardWithPicks {
  id: string;
  user_id: string | null;
  status: CardStatus;
  score: number;
  total_picks: number;
  locked_at: string | null;
  resolved_at: string | null;
  challenge_id: string | null;
  challenges?: {
    challenger_id: string;
    opponent_id: string | null;
    opponent_email: string | null;
    lobby_type: string;
    max_participants: number | null;
    challenger: { username: string };
    opponent: { username: string } | null;
  } | null;
  created_at: string;
  picks: {
    id: string;
    card_id: string;
    prop_id: string;
    selection: PickSelection;
    result: "pending" | "hit" | "miss" | "push" | "dnp";
    actual_value: number | null;
    created_at: string;
    props?: {
      player_name: string;
      player_id: string | null;
      player_team: string | null;
      player_position: string | null;
      stat_category: string;
      line: number;
      game_id: string;
      games?: {
        sport: string;
        home_team: string;
        away_team: string;
        home_score: number | null;
        away_score: number | null;
        commence_time: string | null;
        external_event_id: string | null;
        status: string | null;
      };
    };
  }[];
}

export async function createCard(
  picks: { prop_id: string; selection: PickSelection }[],
  anonId?: string,
  challengeId?: string | null,
  gameMode?: string,
  cardSize?: number
): Promise<CardWithPicks> {
  const body: Record<string, unknown> = { picks, anon_id: anonId };
  if (challengeId) body.challenge_id = challengeId;
  if (gameMode) body.game_mode = gameMode;
  if (cardSize !== undefined) body.card_size = cardSize;

  const response = await fetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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
