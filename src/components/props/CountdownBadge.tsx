"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

const LOCK_BUFFER_MS = 5 * 60 * 1000;

interface CountdownBadgeProps {
  commenceTime: string;
  size?: "sm" | "default";
}

function dayLabel(date: Date): string {
  const now = new Date();
  const gameDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (gameDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatStaticTime(date: Date): string {
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dayLabel(date)} ${time}`;
}

function getTimeLeft(commenceTime: string): number {
  const lockTime = new Date(commenceTime).getTime() - LOCK_BUFFER_MS;
  return lockTime - Date.now();
}

export default function CountdownBadge({
  commenceTime,
  size = "default",
}: CountdownBadgeProps) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(commenceTime));

  useEffect(() => {
    const remaining = getTimeLeft(commenceTime);
    setTimeLeft(remaining);

    if (remaining <= 0) return;

    // >60min: no ticking needed (static time display)
    // 5-60min: tick every 30s
    // <5min: tick every 1s
    const intervalMs =
      remaining > 60 * 60 * 1000 ? null
      : remaining > 5 * 60 * 1000 ? 30_000
      : 1_000;

    if (intervalMs === null) return;

    const id = setInterval(() => {
      const updated = getTimeLeft(commenceTime);
      setTimeLeft(updated);
      if (updated <= 0) clearInterval(id);
    }, intervalMs);

    return () => clearInterval(id);
  }, [commenceTime]);

  // Locked — hide defensively
  if (timeLeft <= 0) return null;

  const commenceDate = new Date(commenceTime);

  // >60min: show static time
  if (timeLeft > 60 * 60 * 1000) {
    const label = formatStaticTime(commenceDate);
    if (size === "sm") {
      return (
        <span className="text-[10px] text-muted-foreground">{label}</span>
      );
    }
    return (
      <Badge variant="secondary" className="text-xs font-medium">
        {label}
      </Badge>
    );
  }

  // 5-60min: amber countdown in minutes
  if (timeLeft > 5 * 60 * 1000) {
    const mins = Math.ceil(timeLeft / 60_000);
    const label = `Locks in ${mins}m`;
    if (size === "sm") {
      return (
        <span className="text-[10px] font-medium text-amber-500">{label}</span>
      );
    }
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/10 text-xs font-medium text-amber-500"
      >
        {label}
      </Badge>
    );
  }

  // <5min: red urgent countdown in m:ss
  const totalSecs = Math.ceil(timeLeft / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  const label = `Locks in ${mins}:${secs.toString().padStart(2, "0")}`;

  if (size === "sm") {
    return (
      <span className="text-[10px] font-semibold text-red-500">{label}</span>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-red-500/40 bg-red-500/10 text-xs font-semibold text-red-500"
    >
      {label}
    </Badge>
  );
}
