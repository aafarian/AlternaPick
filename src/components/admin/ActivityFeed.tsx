"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ActivityFilters, {
  type ActivityFilterValues,
} from "@/components/admin/ActivityFilters";
import type {
  AdminActivityItem,
  AdminActivityEventType,
  AdminActivityFeedResponse,
} from "@/lib/admin/types";
import {
  ACTIVITY_EVENT_COLORS,
  ACTIVITY_EVENT_TYPES,
} from "@/lib/admin/types";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { timeAgo, userInitials } from "@/lib/admin/helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function eventLabel(type: AdminActivityEventType): string {
  const found = ACTIVITY_EVENT_TYPES.find((e) => e.value === type);
  return found?.label ?? type;
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-48" />
      </div>
      <Skeleton className="h-3 w-12 shrink-0" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity item row
// ---------------------------------------------------------------------------

function ActivityRow({ item }: { item: AdminActivityItem }) {
  const colorClasses =
    ACTIVITY_EVENT_COLORS[item.type] ?? "bg-muted text-muted-foreground";

  const cardId = item.metadata.cardId as string | undefined;
  const challengeId = item.metadata.challengeId as string | undefined;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {/* Avatar */}
      <Avatar size="sm" className="mt-0.5">
        {item.avatarUrl && (
          <AvatarImage src={item.avatarUrl} alt={item.username} />
        )}
        <AvatarFallback>
          {userInitials(item.displayName ?? item.username)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/admin/users/${item.userId}`}
            className="text-sm font-medium text-foreground hover:underline"
          >
            {item.displayName ?? item.username}
          </Link>
          <Badge variant="secondary" className={colorClasses}>
            {eventLabel(item.type)}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {item.description}
          {cardId && (
            <>
              {" "}
              <Link
                href={`/admin/lookup/card/${cardId}`}
                className="font-mono text-xs text-primary hover:underline"
              >
                {cardId.slice(0, 8)}
              </Link>
            </>
          )}
          {challengeId && (
            <>
              {" "}
              <Link
                href={`/admin/lookup/challenge/${challengeId}`}
                className="font-mono text-xs text-primary hover:underline"
              >
                {challengeId.slice(0, 8)}
              </Link>
            </>
          )}
        </p>
      </div>

      {/* Timestamp */}
      <span
        className="shrink-0 text-xs text-muted-foreground whitespace-nowrap pt-0.5"
        title={new Date(item.timestamp).toLocaleString()}
      >
        {timeAgo(item.timestamp)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

export default function ActivityFeed() {
  const [filters, setFilters] = useState<ActivityFilterValues>({});
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track the latest fetch to avoid stale responses
  const fetchIdRef = useRef(0);

  const fetchActivity = useCallback(
    async (currentFilters: ActivityFilterValues, currentPage: number) => {
      const id = ++fetchIdRef.current;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", String(PAGE_SIZE));

        if (currentFilters.type) params.set("type", currentFilters.type);
        if (currentFilters.dateFrom) {
          params.set("dateFrom", new Date(currentFilters.dateFrom).toISOString());
        }
        if (currentFilters.dateTo) {
          // Set to end of day
          const endOfDay = new Date(currentFilters.dateTo);
          endOfDay.setHours(23, 59, 59, 999);
          params.set("dateTo", endOfDay.toISOString());
        }

        const res = await fetch(`/api/admin/activity?${params.toString()}`);
        if (!res.ok) {
          throw new Error(`Failed to load activity feed (${res.status})`);
        }

        const data: AdminActivityFeedResponse = await res.json();

        // Guard against stale responses
        if (id !== fetchIdRef.current) return;

        // Client-side username filter
        let filtered = data.items;
        if (currentFilters.userSearch) {
          const search = currentFilters.userSearch.toLowerCase();
          filtered = data.items.filter(
            (item) =>
              item.username.toLowerCase().includes(search) ||
              (item.displayName?.toLowerCase().includes(search) ?? false)
          );
        }

        setItems(filtered);
        setTotal(currentFilters.userSearch ? filtered.length : data.total);
      } catch (err) {
        if (id !== fetchIdRef.current) return;
        setError(
          err instanceof Error ? err.message : "An unexpected error occurred."
        );
      } finally {
        if (id === fetchIdRef.current) {
          setLoading(false);
        }
      }
    },
    []
  );

  // Fetch whenever filters or page change
  useEffect(() => {
    fetchActivity(filters, page);
  }, [filters, page, fetchActivity]);

  // When filters change, reset to page 1
  const handleFiltersChange = useCallback(
    (next: ActivityFilterValues) => {
      setFilters(next);
      setPage(1);
    },
    []
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Displayed items — already filtered
  const displayedItems = items;

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <div className="space-y-4">
        <ActivityFilters filters={filters} onFiltersChange={handleFiltersChange} />
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
          <Activity className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">
              Unable to load activity feed
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button
            variant="outline"
            onClick={() => fetchActivity(filters, page)}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-4">
      {/* Header with filters and refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ActivityFilters filters={filters} onFiltersChange={handleFiltersChange} />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchActivity(filters, page)}
          disabled={loading}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Activity list */}
      <div className="rounded-xl border border-border bg-card">
        {loading ? (
          // Skeleton rows
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : displayedItems.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">No activity found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try adjusting the filters or date range.
              </p>
            </div>
          </div>
        ) : (
          // Items list
          <div className="divide-y divide-border">
            {displayedItems.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && displayedItems.length > 0 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
