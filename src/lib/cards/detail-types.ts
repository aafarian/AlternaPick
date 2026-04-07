/**
 * Response shape for GET /api/cards/[id], used by the analytics card history
 * modal to lazy-load card details on expand.
 */

export interface CardDetailPick {
  id: string;
  propId: string;
  playerName: string;
  playerTeam: string | null;
  statCategory: string;
  line: number;
  selection: string;
  result: string;
  actualValue: number | null;
  homeTeam: string | null;
  awayTeam: string | null;
  commenceTime: string | null;
  sport: string | null;
}

export interface CardDetailResponse {
  id: string;
  status: string;
  score: number;
  totalPicks: number;
  cardSize: number;
  gameMode: string;
  lockedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  picks: CardDetailPick[];
}
