"use client";

import { useMemo, useState, useCallback } from "react";
import { BarChart3, Shield } from "lucide-react";
import type {
  RecapData,
  SpotlightType,
  BreakdownEntry,
} from "@/lib/recaps/compute";
import { StaggerChildren, StaggerItem } from "@/components/motion";
import { teamFullName } from "@/lib/constants";
import { catLabel } from "./tiles/shared";
import { SpotlightTile } from "./tiles/SpotlightTile";
import { MostPickedPlayersTile } from "./tiles/MostPickedPlayersTile";
import { MostPickedPropsTile } from "./tiles/MostPickedPropsTile";
import { ConsensusTile } from "./tiles/ConsensusTile";
import { UnanimousPropsTile } from "./tiles/UnanimousPropsTile";
import { TrapLockTile } from "./tiles/TrapLockTile";
import { PerfectCardsTile } from "./tiles/PerfectCardsTile";
import { TeamCalloutTile } from "./tiles/TeamCalloutTile";
import { PropDifficultyTile } from "./tiles/PropDifficultyTile";
import { OverUnderTile } from "./tiles/OverUnderTile";
import { CardScoreboardTile } from "./tiles/CardScoreboardTile";
import { PlayerHeroVillainTile } from "./tiles/PlayerHeroVillainTile";
import { MostPopularStatTile } from "./tiles/MostPopularStatTile";
import { BreakdownTile } from "./tiles/BreakdownTile";
import { PropPicksModal } from "@/components/recap/PropPicksModal";
import { PlayerPicksModal } from "@/components/recap/PlayerPicksModal";
import type { PropClickInfo, PlayerClickInfo } from "./tiles/shared";

// Spotlight types that are rendered as dedicated grouped tiles
const GROUPED_TYPES: Set<SpotlightType> = new Set([
  "most_picked",
  "category_hot",
  "category_cold",
  "team_hot",
  "team_cold",
  "sport_hot",
  "sport_cold",
  "perfect_cards",
  "over_under_skew",
  "player_trap",
  "player_lock",
  "prop_unanimous",
  "consensus_upset",
]);

interface RecapTileGridProps {
  recapData: RecapData;
  dateFrom?: string;
  dateTo?: string;
}

export function RecapTileGrid({ recapData, dateFrom, dateTo }: RecapTileGridProps) {
  const [selectedProp, setSelectedProp] = useState<PropClickInfo | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerClickInfo | null>(null);
  const onPropClick = useCallback((info: PropClickInfo) => setSelectedProp(info), []);
  const onPlayerClick = useCallback((info: PlayerClickInfo) => setSelectedPlayer(info), []);
  const avgRate = recapData.platformHitRate;

  // Pre-compute derived data once
  const {
    spotlights,
    consensusTrap,
    consensusWin,
    unanimousProps,
    bestTeam,
    worstTeam,
  } = useMemo(() => {
    const filtered = (recapData.spotlights ?? []).filter(
      (s) => !GROUPED_TYPES.has(s.type),
    );

    const consensus = recapData.consensusPicks ?? [];
    const trap = consensus
      .filter((c) => !c.wasCorrect)
      .sort((a, b) => b.dominantPct - a.dominantPct);
    const win = consensus
      .filter((c) => c.wasCorrect)
      .sort((a, b) => b.dominantPct - a.dominantPct);
    const unanimous = consensus.filter((c) => c.dominantPct >= 0.99);

    // Pre-compute best/worst team
    const eligible = (recapData.teamBreakdown ?? []).filter(
      (t) => t.pickCount >= 2,
    );
    let best: BreakdownEntry | null = null;
    let worst: BreakdownEntry | null = null;
    if (eligible.length >= 1) {
      best = eligible.reduce((a, b) => (a.hitRate > b.hitRate ? a : b));
      if (best.hitRate <= avgRate) best = null;
    }
    if (eligible.length >= 2) {
      const w = eligible.reduce((a, b) => (a.hitRate < b.hitRate ? a : b));
      if (w.hitRate < avgRate && (!best || w.key !== best.key)) worst = w;
    }

    return {
      spotlights: filtered,
      consensusTrap: trap,
      consensusWin: win,
      unanimousProps: unanimous,
      bestTeam: best,
      worstTeam: worst,
    };
  }, [recapData, avgRate]);

  const hasAnyContent =
    spotlights.length > 0 ||
    (recapData.mostPickedPlayers?.length ?? 0) > 0 ||
    (recapData.mostPickedProps?.length ?? 0) > 0 ||
    (recapData.trapProps?.length ?? 0) > 0 ||
    (recapData.lockProps?.length ?? 0) > 0 ||
    (recapData.statCategoryBreakdown?.length ?? 0) > 0 ||
    (recapData.sportBreakdown?.length ?? 0) > 0 ||
    (recapData.teamBreakdown?.length ?? 0) > 0 ||
    (recapData.perfectCards?.count ?? 0) > 0;

  if (!hasAnyContent) return null;

  const players = recapData.mostPickedPlayers ?? [];
  const props = recapData.mostPickedProps ?? [];
  const traps = recapData.trapProps ?? [];
  const locks = recapData.lockProps ?? [];
  const perfectCount = recapData.perfectCards?.count ?? 0;
  const overCount = recapData.overCount ?? 0;
  const underCount = recapData.underCount ?? 0;
  const catBreakdown = recapData.statCategoryBreakdown ?? [];
  const sportBreakdown = recapData.sportBreakdown ?? [];
  const teamBreakdown = recapData.teamBreakdown ?? [];
  const good = recapData.playerSpotlightsGood ?? [];
  const bad = recapData.playerSpotlightsBad ?? [];

  return (
    <StaggerChildren className="grid grid-cols-1 sm:grid-cols-2 gap-3" staggerDelay={0.06}>
      {/* Individual spotlight tiles */}
      {spotlights.map((s) => (
        <StaggerItem key={`spot-${s.type}-${s.subject ?? ""}-${s.value}`}>
          <SpotlightTile spotlight={s} onPlayerClick={onPlayerClick} />
        </StaggerItem>
      ))}

      {/* Most Picked Players */}
      {players.length > 0 && (
        <StaggerItem><MostPickedPlayersTile players={players} onPlayerClick={onPlayerClick} /></StaggerItem>
      )}

      {/* Top Props */}
      {props.length > 0 && (
        <StaggerItem><MostPickedPropsTile props={props} onPropClick={onPropClick} /></StaggerItem>
      )}

      {/* Consensus Trap */}
      {consensusTrap.length > 0 && (
        <StaggerItem><ConsensusTile picks={consensusTrap} variant="trap" onPropClick={onPropClick} /></StaggerItem>
      )}

      {/* Consensus Win */}
      {consensusWin.length > 0 && (
        <StaggerItem><ConsensusTile picks={consensusWin} variant="win" onPropClick={onPropClick} /></StaggerItem>
      )}

      {/* Unanimous Props */}
      {unanimousProps.length > 0 && (
        <StaggerItem><UnanimousPropsTile picks={unanimousProps} onPropClick={onPropClick} /></StaggerItem>
      )}

      {/* Traps */}
      {traps.length > 0 && (
        <StaggerItem><TrapLockTile items={traps} variant="trap" onPropClick={onPropClick} /></StaggerItem>
      )}

      {/* Locks */}
      {locks.length > 0 && (
        <StaggerItem><TrapLockTile items={locks} variant="lock" onPropClick={onPropClick} /></StaggerItem>
      )}

      {/* Perfect Cards */}
      {perfectCount > 0 && (
        <StaggerItem>
          <PerfectCardsTile
            count={perfectCount}
            usernames={recapData.perfectCards?.usernames ?? []}
            entries={recapData.perfectCards?.entries}
          />
        </StaggerItem>
      )}

      {/* Best Team */}
      {bestTeam && (
        <StaggerItem><TeamCalloutTile team={bestTeam} variant="best" /></StaggerItem>
      )}

      {/* Worst Team */}
      {worstTeam && (
        <StaggerItem><TeamCalloutTile team={worstTeam} variant="worst" /></StaggerItem>
      )}

      {/* Prop Difficulty */}
      {traps.length + locks.length >= 2 && (
        <StaggerItem>
          <PropDifficultyTile lockCount={locks.length} trapCount={traps.length} />
        </StaggerItem>
      )}

      {/* Over/Under Skew */}
      {overCount + underCount > 0 && (
        <StaggerItem>
          <OverUnderTile overCount={overCount} underCount={underCount} />
        </StaggerItem>
      )}

      {/* Card Scoreboard */}
      {recapData.totalCards >= 3 && (
        <StaggerItem>
          <CardScoreboardTile
            totalPicks={recapData.totalPicks}
            totalCards={recapData.totalCards}
            platformHitRate={avgRate}
          />
        </StaggerItem>
      )}

      {/* Player Hero/Villain */}
      {(good.length > 0 || bad.length > 0) && (
        <StaggerItem>
          <PlayerHeroVillainTile good={good} bad={bad} platformHitRate={avgRate} onPlayerClick={onPlayerClick} />
        </StaggerItem>
      )}

      {/* Most Popular Stat */}
      {catBreakdown.length > 0 && (
        <StaggerItem>
          <MostPopularStatTile breakdown={catBreakdown} platformHitRate={avgRate} />
        </StaggerItem>
      )}

      {/* By Category */}
      {catBreakdown.length > 0 && (
        <StaggerItem>
          <BreakdownTile
            title="By Category"
            icon={BarChart3}
            items={catBreakdown}
            avgRate={avgRate}
            formatKey={catLabel}
          />
        </StaggerItem>
      )}

      {/* By Sport */}
      {sportBreakdown.length > 0 && (
        <StaggerItem>
          <BreakdownTile
            title="By Sport"
            icon={BarChart3}
            items={sportBreakdown}
            avgRate={avgRate}
            formatKey={(k) => k.toUpperCase()}
          />
        </StaggerItem>
      )}

      {/* By Team */}
      {teamBreakdown.length > 0 && (
        <StaggerItem>
          <BreakdownTile
            title="By Team"
            icon={Shield}
            items={teamBreakdown}
            avgRate={avgRate}
            formatKey={teamFullName}
          />
        </StaggerItem>
      )}
      <PropPicksModal
        propId={selectedProp?.propId ?? null}
        playerName={selectedProp?.playerName ?? ""}
        statCategory={selectedProp?.statCategory ?? ""}
        line={selectedProp?.line ?? 0}
        onClose={() => setSelectedProp(null)}
      />
      <PlayerPicksModal
        playerName={selectedPlayer?.playerName ?? null}
        sport={selectedPlayer?.sport}
        statCategory={selectedPlayer?.statCategory}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onClose={() => setSelectedPlayer(null)}
      />
    </StaggerChildren>
  );
}
