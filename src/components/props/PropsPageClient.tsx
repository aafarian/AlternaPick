"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Game, Prop, StatCategory } from "@/lib/supabase/types";
import { type SportKey, UI_SPORTS, SPORT_CONFIG } from "@/lib/sports";
import { teamMatchesQuery } from "@/lib/constants";
import { LOCK_BUFFER_MS } from "@/lib/challenges/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import PropsHeader from "./PropsHeader";
import PropsGameList from "./PropsGameList";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";

type GameWithProps = Game & { props: Prop[] };

interface PropsPageClientProps {
  allGames: GameWithProps[];
  initialSport: SportKey;
  propCounts: Record<string, number>;
  ncaabTeams?: Record<string, string>;
}

export default function PropsPageClient({
  allGames,
  initialSport,
  propCounts,
  ncaabTeams: _ncaabTeams,
}: PropsPageClientProps) {
  const [sport, setSport] = useState<SportKey>(initialSport);
  const [category, setCategory] = useState<StatCategory | "all">("all");
  const [playerQuery, setPlayerQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Reset category when switching sports
  const handleSportChange = useCallback((s: SportKey) => {
    setSport(s);
    setCategory("all");
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setPlayerQuery(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(next.trim().toLowerCase()), 200);
  }, []);

  const handleClearSearch = useCallback(() => {
    setPlayerQuery("");
    setDebouncedQuery("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const categories = SPORT_CONFIG[sport].categories;
  const emptyEmoji = SPORT_CONFIG[sport].icon;
  const now = Date.now();

  const filteredGames = useMemo(() => {
    const isAll = category === "all";
    return allGames
      .filter((g) => g.sport === sport)
      .filter((g) => new Date(g.commence_time).getTime() - now > LOCK_BUFFER_MS)
      .map((game) => ({
        ...game,
        props: game.props
          .filter((p) => isAll || p.stat_category === (category as StatCategory))
          .filter(
            (p) =>
              !debouncedQuery ||
              p.player_name.toLowerCase().includes(debouncedQuery) ||
              teamMatchesQuery(p.player_team, debouncedQuery) ||
              game.home_team.toLowerCase().includes(debouncedQuery) ||
              game.away_team.toLowerCase().includes(debouncedQuery)
          )
          .sort((a, b) => a.player_name.localeCompare(b.player_name)),
      }))
      .filter((g) => g.props.length > 0);
  }, [allGames, sport, category, debouncedQuery, now]);

  return (
    <div className="flex flex-col gap-6 py-8">
      <PropsHeader gameCount={filteredGames.length} />

      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-2 overflow-x-hidden border-b border-white/5 bg-background/95 px-4 pb-2 pt-1.5 backdrop-blur-md">
        {/* Sport tabs */}
        <div className="flex items-center gap-0.5">
          {UI_SPORTS.map((key) => {
            const isActive = sport === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleSportChange(key)}
                className={cn(
                  "relative px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sport-tab-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                {SPORT_CONFIG[key].shortLabel}
                {propCounts[key] ? (
                  <span className="ml-1 text-[10px] opacity-60">({propCounts[key]})</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Player search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search players or teams..."
            value={playerQuery}
            onChange={handleSearchChange}
            className="pl-9 pr-9"
          />
          {playerQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {categories.map(({ value, label }) => {
            const isActive = category === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  "relative shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  isActive
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="category-pill-indicator"
                    className="absolute inset-0 rounded-md bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-[1]">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Game list with animated transition */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${sport}-${category}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {filteredGames.length === 0 ? (
            <AnimatedEmptyState
              icon={emptyEmoji}
              title={debouncedQuery || category !== "all" ? "No props found" : "No games available"}
              description={
                debouncedQuery || category !== "all"
                  ? "Try adjusting your search or filters."
                  : "Check back later for upcoming player props!"
              }
            />
          ) : (
            <PropsGameList games={filteredGames} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
