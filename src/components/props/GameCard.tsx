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
  const awayCode = teamTricode(game.away_team);
  const homeCode = teamTricode(game.home_team);

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

      {expanded && (() => {
        // Interleave teams: away fills the left half of the grid, home fills the right half.
        // For a 4-column grid: cols 1-2 = away, cols 3-4 = home.
        const sortByStat = (a: Prop, b: Prop) =>
          (STAT_SORT_ORDER[a.stat_category] ?? 99) - (STAT_SORT_ORDER[b.stat_category] ?? 99);

        const awayProps = game.props.filter((p) => p.player_team === awayCode).sort(sortByStat);
        const homeProps = game.props.filter((p) => p.player_team === homeCode).sort(sortByStat);

        // Interleave in chunks so left half of grid = away, right half = home.
        // 2-col (mobile): 1 away, 1 home per row → left=away, right=home
        // 4-col (desktop): 2 away, 2 home per row → left half=away, right half=home
        const COLS_DESKTOP = 4;
        const HALF = COLS_DESKTOP / 2; // 2 away slots, then 2 home slots per row
        const maxLen = Math.max(awayProps.length, homeProps.length);
        const rows = Math.ceil(maxLen / HALF);
        const interleaved: (Prop | null)[] = [];

        for (let row = 0; row < rows; row++) {
          // Away chunk (left half)
          for (let col = 0; col < HALF; col++) {
            const idx = row * HALF + col;
            interleaved.push(idx < awayProps.length ? awayProps[idx] : null);
          }
          // Home chunk (right half)
          for (let col = 0; col < HALF; col++) {
            const idx = row * HALF + col;
            interleaved.push(idx < homeProps.length ? homeProps[idx] : null);
          }
        }

        return (
          <CardContent className="p-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {interleaved.map((prop, idx) =>
                prop ? (
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
                ) : (
                  <div key={`empty-${idx}`} />
                ),
              )}
            </div>
          </CardContent>
        );
      })()}
    </Card>
  );
}
