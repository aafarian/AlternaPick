"use client";

import { useMemo } from "react";
import { BarChart3, Shield } from "lucide-react";
import type {
  RecapData,
  SpotlightType,
  BreakdownEntry,
} from "@/lib/recaps/compute";
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
]);

export function RecapTileGrid({ recapData }: { recapData: RecapData }) {
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="region" aria-label="Recap insights">
      {/* Individual spotlight tiles */}
      {spotlights.map((s) => (
        <SpotlightTile
          key={`spot-${s.type}-${s.subject ?? ""}-${s.value}`}
          spotlight={s}
        />
      ))}

      {/* Most Picked Players */}
      <MostPickedPlayersTile players={recapData.mostPickedPlayers ?? []} />

      {/* Top Props */}
      <MostPickedPropsTile props={recapData.mostPickedProps ?? []} />

      {/* Consensus Trap */}
      <ConsensusTile picks={consensusTrap} variant="trap" />

      {/* Consensus Win */}
      <ConsensusTile picks={consensusWin} variant="win" />

      {/* Unanimous Props */}
      <UnanimousPropsTile picks={unanimousProps} />

      {/* Traps */}
      <TrapLockTile items={recapData.trapProps ?? []} variant="trap" />

      {/* Locks */}
      <TrapLockTile items={recapData.lockProps ?? []} variant="lock" />

      {/* Perfect Cards */}
      <PerfectCardsTile
        count={recapData.perfectCards?.count ?? 0}
        usernames={recapData.perfectCards?.usernames ?? []}
        entries={recapData.perfectCards?.entries}
      />

      {/* Best Team */}
      {bestTeam && <TeamCalloutTile team={bestTeam} variant="best" />}

      {/* Worst Team */}
      {worstTeam && <TeamCalloutTile team={worstTeam} variant="worst" />}

      {/* Prop Difficulty */}
      <PropDifficultyTile
        lockCount={(recapData.lockProps ?? []).length}
        trapCount={(recapData.trapProps ?? []).length}
      />

      {/* Over/Under Skew */}
      <OverUnderTile
        overCount={recapData.overCount ?? 0}
        underCount={recapData.underCount ?? 0}
      />

      {/* Card Scoreboard */}
      <CardScoreboardTile
        totalPicks={recapData.totalPicks}
        totalCards={recapData.totalCards}
        platformHitRate={avgRate}
      />

      {/* Player Hero/Villain */}
      <PlayerHeroVillainTile
        good={recapData.playerSpotlightsGood ?? []}
        bad={recapData.playerSpotlightsBad ?? []}
        platformHitRate={avgRate}
      />

      {/* Most Popular Stat */}
      <MostPopularStatTile
        breakdown={recapData.statCategoryBreakdown ?? []}
        platformHitRate={avgRate}
      />

      {/* By Category */}
      <BreakdownTile
        title="By Category"
        icon={BarChart3}
        items={recapData.statCategoryBreakdown ?? []}
        avgRate={avgRate}
        formatKey={catLabel}
      />

      {/* By Sport */}
      <BreakdownTile
        title="By Sport"
        icon={BarChart3}
        items={recapData.sportBreakdown ?? []}
        avgRate={avgRate}
        formatKey={(k) => k.toUpperCase()}
      />

      {/* By Team */}
      <BreakdownTile
        title="By Team"
        icon={Shield}
        items={recapData.teamBreakdown ?? []}
        avgRate={avgRate}
      />
    </div>
  );
}
