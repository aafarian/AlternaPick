"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { catLabel } from "@/lib/constants";
import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { ChevronRight } from "lucide-react";
import { type PickerInfo, sportLabel, ResultIcon, hitRateColor, hitRateBg } from "./tiles/shared";

interface PropResult {
  propId: string;
  statCategory: string;
  line: number;
  sport: string;
  hitRate: number;
  pickCount: number;
  actualValue: number | null;
  pickers: PickerInfo[];
}

interface PlayerPicksModalProps {
  playerName: string | null;
  sport?: string;
  statCategory?: string;
  team?: string;
  dateFrom?: string;
  dateTo?: string;
  onClose: () => void;
}

export function PlayerPicksModal({
  playerName,
  sport,
  statCategory: filterStat,
  team,
  dateFrom,
  dateTo,
  onClose,
}: PlayerPicksModalProps) {
  const [propResults, setPropResults] = useState<PropResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedProp, setExpandedProp] = useState<string | null>(null);
  const prefersReduced = useReducedMotion();

  // Modal is open when any filter is provided
  const hasFilter = !!playerName || !!filterStat || !!team;

  useEffect(() => {
    if (!hasFilter) {
      setPropResults([]);
      setExpandedProp(null);
      return;
    }
    setLoading(true);
    setExpandedProp(null);
    const params = new URLSearchParams();
    if (playerName) params.set("playerName", playerName);
    if (filterStat) params.set("statCategory", filterStat);
    if (team) params.set("team", team);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    fetch(`/api/recap/player-picks?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setPropResults(data.props ?? []);
      })
      .catch(() => {
        // Silently fail — empty state is shown in the UI
      })
      .finally(() => setLoading(false));
  }, [playerName, filterStat, team, dateFrom, dateTo, hasFilter]);

  const totalPicks = propResults.reduce((sum, p) => sum + p.pickCount, 0);
  const totalHits = propResults.reduce(
    (sum, p) => sum + p.pickers.filter((pk) => pk.result === "hit").length,
    0,
  );
  const overallHitRate = totalPicks > 0 ? totalHits / totalPicks : 0;
  const displaySport = sport ?? propResults[0]?.sport;

  return (
    <Dialog open={hasFilter} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-transparent px-5 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold">
                {playerName}
              </DialogTitle>
              {displaySport && displaySport !== "unknown" && (
                <Badge className="shrink-0 text-[9px] bg-primary/15 text-primary border-primary/30">
                  {sportLabel(displaySport)}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              {filterStat && catLabel(filterStat) + " — "}
              {totalPicks} pick{totalPicks !== 1 ? "s" : ""} across {propResults.length} prop{propResults.length !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-5 pb-5">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={prefersReduced ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={prefersReduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="py-2"
              >
                <AnimatedSkeleton count={3} variant="row" className="h-14" />
              </motion.div>
            ) : propResults.length === 0 ? (
              <motion.p
                key="empty"
                initial={prefersReduced ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                No picks found for this player.
              </motion.p>
            ) : (
              <motion.div
                key="content"
                initial={prefersReduced ? undefined : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {/* Summary */}
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 rounded-lg bg-neon-green/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold tabular-nums text-neon-green">{totalHits}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-neon-green/70">Hit</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-bold-red/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold tabular-nums text-bold-red">{totalPicks - totalHits}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-bold-red/70">Miss</p>
                  </div>
                  <div className={`flex-1 rounded-lg px-3 py-2 text-center ${hitRateBg(overallHitRate)}`}>
                    <p className={`text-lg font-bold tabular-nums ${hitRateColor(overallHitRate)}`}>
                      {Math.round(overallHitRate * 100)}%
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Hit Rate</p>
                  </div>
                </div>

                {/* Prop list */}
                <div className="max-h-64 overflow-y-auto flex flex-col gap-1.5">
                  {propResults.map((prop, i) => {
                    const propCatLabel = catLabel(prop.statCategory);
                    const isExpanded = expandedProp === prop.propId;

                    return (
                      <motion.div
                        key={prop.propId}
                        initial={prefersReduced ? undefined : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: prefersReduced ? 0 : i * 0.04 }}
                      >
                        <button
                          type="button"
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 w-full text-left cursor-pointer transition-colors ${hitRateBg(prop.hitRate)} hover:bg-foreground/5`}
                          onClick={() => setExpandedProp(isExpanded ? null : prop.propId)}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {prop.line} {propCatLabel}
                              {prop.actualValue != null && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  (actual: {prop.actualValue})
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {prop.pickCount} pick{prop.pickCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                          <span className={`text-sm font-bold tabular-nums shrink-0 ${hitRateColor(prop.hitRate)}`}>
                            {Math.round(prop.hitRate * 100)}%
                          </span>
                          <ChevronRight
                            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          />
                        </button>

                        {/* Expanded pickers */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={prefersReduced ? undefined : { height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={prefersReduced ? undefined : { height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeOut" }}
                              className="overflow-hidden"
                            >
                              <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-border/40 pl-3 pb-1">
                                {prop.pickers.map((p, j) => (
                                  <div
                                    key={j}
                                    className="flex items-center gap-2 py-1 text-xs"
                                  >
                                    <ResultIcon result={p.result} />
                                    <span className="font-medium text-foreground truncate flex-1">
                                      {p.username}
                                    </span>
                                    <span className="text-muted-foreground capitalize shrink-0">
                                      {p.selection}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
