"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface PropsHeaderProps {
  gameCount: number;
}

export default function PropsHeader({ gameCount }: PropsHeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/props/sync", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setSyncResult(data.error ?? "Sync failed");
        return;
      }

      if (data.synced) {
        setSyncResult(
          `Synced ${data.propsCount} props from ${data.gamesCount} games`
        );
        window.location.reload();
      } else {
        setSyncResult("Cache is fresh — no sync needed");
      }
    } catch {
      setSyncResult("Network error — try again");
    } finally {
      setSyncing(false);
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Tonight&apos;s Props
        </h1>
        <p className="text-sm text-muted-foreground">
          {today} &middot; {gameCount} game{gameCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {syncResult && (
          <span className="text-xs text-muted-foreground">{syncResult}</span>
        )}
        <Button
          onClick={handleSync}
          disabled={syncing}
          variant="secondary"
          size="sm"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Refresh Props"}
        </Button>
      </div>
    </div>
  );
}
