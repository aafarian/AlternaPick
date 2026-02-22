"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import RankBadge from "./RankBadge";
import type { LeaderboardEntryWithProfile } from "@/app/api/leaderboard/route";
import type { IconConfig } from "@/lib/icons/types";
import UserAvatar from "@/components/icons/UserAvatar";
import { TableCell, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/motion";

/** Glow colors for top-3 ranks */
const TOP3_GLOW: Record<number, string> = {
  1: "rgba(251,191,36,0.35)", // gold
  2: "rgba(148,163,184,0.30)", // silver
  3: "rgba(217,119,6,0.30)", // bronze
};

interface LeaderboardRowProps {
  entry: LeaderboardEntryWithProfile;
  isCurrentUser: boolean;
  variant: "desktop" | "mobile";
  sort: "hit_rate" | "h2h";
}

export default function LeaderboardRow({
  entry,
  isCurrentUser,
  variant,
  sort,
}: LeaderboardRowProps) {
  const { rank, user, stats } = entry;
  const prefersReduced = useReducedMotion();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const trRef = useRef<HTMLTableRowElement | null>(null);

  // Top-3 glow flash on mount
  const glowColor = TOP3_GLOW[rank];
  useEffect(() => {
    if (prefersReduced || !glowColor) return;
    const el = variant === "mobile" ? rowRef.current : trRef.current;
    if (!el) return;
    el.style.boxShadow = `0 0 16px 4px ${glowColor}`;
    const timer = setTimeout(() => {
      el.style.transition = "box-shadow 0.8s ease-out";
      el.style.boxShadow = "none";
    }, 600);
    return () => clearTimeout(timer);
  }, [prefersReduced, glowColor, variant]);

  if (variant === "mobile") {
    return (
      <div
        ref={rowRef}
        className={cn(
          "rounded-xl transition-[transform,box-shadow] duration-200",
          !prefersReduced && "hover:-translate-y-0.5 hover:shadow-md"
        )}
      >
        <Card
          className={cn(
            isCurrentUser
              ? "border-primary/20 bg-primary/5"
              : "border-border bg-card"
          )}
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="shrink-0">
              <RankBadge rank={rank} />
            </div>

            <Link
              href={isCurrentUser ? "/profile" : `/users/${user.username}`}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <UserAvatar
                avatarUrl={user.avatar_url}
                iconConfig={user.icon_config as IconConfig | null}
                userId={user.id}
                username={user.username}
                size={40}
                className="shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {user.username}
                  {isCurrentUser && (
                    <span className="ml-1.5 text-xs text-primary">(you)</span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className={cn(sort === "hit_rate" ? "font-bold text-foreground" : "")}>
                    {stats.win_rate.toFixed(1)}%
                  </span>
                  <span>
                    {stats.current_streak}/{stats.best_streak} streak
                  </span>
                  <span className={cn(sort === "h2h" ? "font-bold text-foreground" : "")}>
                    {stats.h2h_wins}W-{stats.h2h_losses}L
                  </span>
                  <span>{stats.total_cards} cards</span>
                </div>
              </div>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TableRow
      ref={trRef}
      className={cn(
        "border-border transition-[transform,box-shadow] duration-200",
        isCurrentUser && "bg-primary/5 border-primary/20",
        !prefersReduced && "hover:bg-muted/40"
      )}
    >
      <TableCell>
        <RankBadge rank={rank} />
      </TableCell>

      <TableCell>
        <Link
          href={isCurrentUser ? "/profile" : `/users/${user.username}`}
          className="flex items-center gap-3"
        >
          <UserAvatar
            avatarUrl={user.avatar_url}
            iconConfig={user.icon_config as IconConfig | null}
            userId={user.id}
            username={user.username}
            size={36}
            className="shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">
              {user.username}
              {isCurrentUser && (
                <span className="ml-1.5 text-xs text-primary">(you)</span>
              )}
            </p>
            <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
          </div>
        </Link>
      </TableCell>

      <TableCell className={cn("text-sm", sort === "hit_rate" ? "font-bold" : "text-muted-foreground")}>
        {stats.win_rate.toFixed(1)}%
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {stats.total_correct_picks}
      </TableCell>

      <TableCell className="text-sm">
        <span className="font-bold">{stats.current_streak}</span>
        <span className="text-muted-foreground"> / {stats.best_streak}</span>
      </TableCell>

      <TableCell className={cn("text-sm", sort === "h2h" ? "font-bold" : "text-muted-foreground")}>
        {stats.h2h_wins}W - {stats.h2h_losses}L
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">
        {stats.total_cards}
      </TableCell>
    </TableRow>
  );
}
