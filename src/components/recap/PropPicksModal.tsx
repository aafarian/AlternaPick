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
import { CATEGORY_LABELS } from "@/lib/constants";
import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { type PickerInfo, sportLabel, ResultIcon, hitRateColor, hitRateBg } from "./tiles/shared";

interface PropPicksModalProps {
  propId: string | null;
  playerName: string;
  statCategory: string;
  line: number;
  onClose: () => void;
}

export function PropPicksModal({
  propId,
  playerName,
  statCategory,
  line,
  onClose,
}: PropPicksModalProps) {
  const [pickers, setPickers] = useState<PickerInfo[]>([]);
  const [sport, setSport] = useState<string>("unknown");
  const [loading, setLoading] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!propId) {
      setPickers([]);
      return;
    }
    setLoading(true);
    fetch(`/api/recap/prop-picks?propId=${encodeURIComponent(propId)}`)
      .then((res) => res.json())
      .then((data) => {
        setPickers(data.pickers ?? []);
        setSport(data.sport ?? "unknown");
      })
      .catch(() => {
        // Silently fail — empty state is shown in the UI
      })
      .finally(() => setLoading(false));
  }, [propId]);

  const categoryLabel =
    CATEGORY_LABELS[statCategory.toLowerCase() as keyof typeof CATEGORY_LABELS] ??
    statCategory;

  const hits = pickers.filter((p) => p.result === "hit").length;
  const misses = pickers.filter((p) => p.result === "miss").length;
  const total = pickers.length;
  const hitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
  const overCount = pickers.filter((p) => p.selection === "over").length;
  const underCount = pickers.filter((p) => p.selection === "under").length;
  const actualValue = pickers.find((p) => p.actualValue != null)?.actualValue ?? null;

  return (
    <Dialog open={!!propId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-b from-primary/10 to-transparent px-5 pt-5 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-bold">
                {playerName}
              </DialogTitle>
              {sport !== "unknown" && (
                <Badge className="shrink-0 text-[9px] bg-primary/15 text-primary border-primary/30">
                  {sportLabel(sport)}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              {line} {categoryLabel}
              {actualValue != null && (
                <span className="ml-2 font-semibold text-foreground">
                  (Actual: {actualValue})
                </span>
              )}
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
                <AnimatedSkeleton count={3} variant="row" className="h-10" />
              </motion.div>
            ) : pickers.length === 0 ? (
              <motion.p
                key="empty"
                initial={prefersReduced ? undefined : { opacity: 0 }}
                animate={{ opacity: 1 }}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                No resolved picks found for this prop.
              </motion.p>
            ) : (
              <motion.div
                key="content"
                initial={prefersReduced ? undefined : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {/* Summary stats */}
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 rounded-lg bg-neon-green/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold tabular-nums text-neon-green">{hits}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-neon-green/70">Hit</p>
                  </div>
                  <div className="flex-1 rounded-lg bg-bold-red/10 px-3 py-2 text-center">
                    <p className="text-lg font-bold tabular-nums text-bold-red">{misses}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-bold-red/70">Miss</p>
                  </div>
                  <div className={`flex-1 rounded-lg px-3 py-2 text-center ${hitRateBg(total > 0 ? hits / total : 0)}`}>
                    <p className={`text-lg font-bold tabular-nums ${hitRateColor(total > 0 ? hits / total : 0)}`}>{hitRate}%</p>
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Hit Rate</p>
                  </div>
                </div>

                {/* Over/Under split bar */}
                {total > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground mb-1">
                      <span>{overCount} Over</span>
                      <span>{underCount} Under</span>
                    </div>
                    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-border/30">
                      <div
                        className="bg-neon-green/60 transition-all duration-500"
                        style={{ width: `${(overCount / total) * 100}%` }}
                      />
                      <div
                        className="bg-electric-blue/60 transition-all duration-500"
                        style={{ width: `${(underCount / total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Picks list */}
                <div className="max-h-56 overflow-y-auto">
                  <div className="flex flex-col gap-1">
                    {pickers.map((p, i) => (
                      <motion.div
                        key={i}
                        initial={prefersReduced ? undefined : { opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: prefersReduced ? 0 : i * 0.03 }}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                          p.result === "hit"
                            ? "bg-neon-green/5"
                            : p.result === "miss"
                              ? "bg-bold-red/5"
                              : "bg-muted/30"
                        }`}
                      >
                        <ResultIcon result={p.result} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {p.username}
                          </p>
                          <p className="text-[11px] text-muted-foreground capitalize">
                            {p.selection}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
