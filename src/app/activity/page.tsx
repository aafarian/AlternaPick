"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import ActivityFeed from "@/components/activity/ActivityFeed";
import type { ActivityItem } from "@/app/api/activity/route";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ActivityPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/activity");
      if (!res.ok) throw new Error("Failed to load activity feed");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load activity feed"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login?redirectTo=/activity");
      return;
    }
    fetchActivity();
  }, [user, authLoading, router, fetchActivity]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex flex-col gap-8 py-8">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-56" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Recent activity from your friends
        </p>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={fetchActivity}
              className="ml-2 text-destructive underline"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      )}

      {/* Feed */}
      {!loading && !error && <ActivityFeed items={items} />}
    </div>
  );
}
