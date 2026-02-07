import type { Game, Prop } from "@/lib/supabase/types";
import PropLine from "./PropLine";

interface GameCardProps {
  game: Game & { props: Prop[] };
}

function formatGameTime(commenceTime: string): string {
  const date = new Date(commenceTime);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Group props by player name
function groupByPlayer(props: Prop[]): Map<string, Prop[]> {
  const grouped = new Map<string, Prop[]>();
  for (const prop of props) {
    const existing = grouped.get(prop.player_name) ?? [];
    existing.push(prop);
    grouped.set(prop.player_name, existing);
  }
  return grouped;
}

export default function GameCard({ game }: GameCardProps) {
  const playerGroups = groupByPlayer(game.props);

  return (
    <div className="rounded-2xl border border-border bg-surface">
      {/* Game header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{game.away_team}</span>
          <span className="text-muted">@</span>
          <span className="font-semibold">{game.home_team}</span>
        </div>
        <span className="text-sm text-muted">
          {formatGameTime(game.commence_time)}
        </span>
      </div>

      {/* Props */}
      <div className="flex flex-col gap-1 p-2">
        {Array.from(playerGroups.entries()).map(([playerName, props]) => (
          <div key={playerName} className="flex flex-col gap-1">
            {props.map((prop) => (
              <PropLine
                key={prop.id}
                playerName={prop.player_name}
                statCategory={prop.stat_category}
                line={prop.line}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
