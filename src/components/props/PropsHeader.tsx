"use client";

import { useState } from "react";

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
        // Refresh the page to show new data
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
        <h1 className="text-3xl font-bold">Tonight&apos;s Props</h1>
        <p className="text-sm text-muted">
          {today} &middot; {gameCount} game{gameCount !== 1 ? "s" : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {syncResult && (
          <span className="text-xs text-muted">{syncResult}</span>
        )}
        <button
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover disabled:opacity-50"
        >
          {syncing ? "Syncing..." : "Refresh Props"}
        </button>
      </div>
    </div>
  );
}
