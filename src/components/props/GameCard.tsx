"use client";

import { ChevronDown } from "lucide-react";
import type { Game, Prop, StatCategory } from "@/lib/supabase/types";
import PropLine from "./PropLine";
import CountdownBadge from "./CountdownBadge";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { teamTricode, teamLogoUrl } from "@/lib/constants";
import { cn } from "@/lib/utils";

const STAT_SORT_ORDER: Record<StatCategory, number> = {
  // NBA
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
  // Soccer
  shots: 12,
  shots_on_target: 13,
  goals: 14,
  tackles: 15,
  passes: 16,
  fouls_committed: 17,
  saves: 18,
};

function TeamLogo({ team }: { team: string }) {
  const url = teamLogoUrl(team);
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={teamTricode(team)}
      width={24}
      height={24}
      className="shrink-0 object-contain"
    />
  );
}

interface GameCardProps {
  game: Game & { props: Prop[] };
  expanded: boolean;
  onToggle: () => void;
}

export default function GameCard({
  game,
  expanded,
  onToggle,
}: GameCardProps) {
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
    <Card id={`game-${game.id}`} className="scroll-mt-40 border-border bg-card">
      <CardHeader
        onClick={onToggle}
        className={cn(
          "flex-row items-center justify-between space-y-0 px-4 py-3 transition-colors hover:bg-secondary/30",
          expanded && "border-b border-border"
        )}
      >
        <div className="flex items-center gap-2.5">
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
          <TeamLogo team={game.away_team} />
          <span className="font-bold">{game.away_team}</span>
          <span className="text-xs text-muted-foreground">@</span>
          <span className="font-bold">{game.home_team}</span>
          <TeamLogo team={game.home_team} />
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {game.props.length} props
          </span>
          <CountdownBadge commenceTime={game.commence_time} />
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
                lineHistory={prop.line_history}
                sport={game.sport}
              />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
