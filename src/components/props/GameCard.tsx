"use client";

import type { Game, Prop, StatCategory } from "@/lib/supabase/types";
import PropLine from "./PropLine";
import CountdownBadge from "./CountdownBadge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { teamTricode } from "@/lib/constants";

const STAT_SORT_ORDER: Record<StatCategory, number> = {
  points: 0,
  rebounds: 1,
  assists: 2,
  threes: 3,
  pra: 4,
  pts_reb: 5,
  pts_ast: 6,
  reb_ast: 7,
  blocks: 8,
  steals: 9,
  blk_stl: 10,
  turnovers: 11,
};

interface GameCardProps {
  game: Game & { props: Prop[] };
}

export default function GameCard({ game }: GameCardProps) {
  // Sort props: group by team (away first, then home), then by stat category within each team
  const awayCode = teamTricode(game.away_team);
  const homeCode = teamTricode(game.home_team);
  const sortedProps = [...game.props].sort((a, b) => {
    const teamOrder = (p: Prop) =>
      p.player_team === awayCode ? 0
        : p.player_team === homeCode ? 1
        : 2;
    const teamDiff = teamOrder(a) - teamOrder(b);
    if (teamDiff !== 0) return teamDiff;

    // Within same team, sort by stat category
    return (STAT_SORT_ORDER[a.stat_category] ?? 99) - (STAT_SORT_ORDER[b.stat_category] ?? 99);
  });

  return (
    <Card id={`game-${game.id}`} className="scroll-mt-32 border-border bg-card">
      <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-bold">{game.away_team}</span>
          <span className="text-muted-foreground">@</span>
          <span className="font-bold">{game.home_team}</span>
        </div>
        <CountdownBadge commenceTime={game.commence_time} />
      </CardHeader>

      <CardContent className="p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedProps.map((prop) => (
            <PropLine
              key={prop.id}
              propId={prop.id}
              gameId={game.id}
              playerName={prop.player_name}
              playerId={prop.player_id}
              playerTeam={prop.player_team}
              playerPosition={prop.player_position}
              statCategory={prop.stat_category}
              line={prop.line}
              awayTeam={game.away_team}
              homeTeam={game.home_team}
              lineHistory={prop.line_history}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
