"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Activity,
  RefreshCw,
  TrendingUp,
  Users,
  Clock,
  Flame,
} from "lucide-react";
import type { AdminDetailedOverview } from "@/lib/admin/types";
import SignupTrendChart from "./SignupTrendChart";
import EngagementMetrics from "./EngagementMetrics";
import ActiveUsersPanel from "./ActiveUsersPanel";
import HourlyActivityChart from "./HourlyActivityChart";
import TokenEconomyPanel from "./TokenEconomyPanel";

function SectionSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[160px] w-full" />
      </CardContent>
    </Card>
  );
}

export default function DetailedOverview() {
  const [data, setData] = useState<AdminDetailedOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview/detailed");
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const json: AdminDetailedOverview = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
        <Activity className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">
            Unable to load detailed analytics
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <SectionSkeleton />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-xl" />
          ))}
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">
          Detailed Analytics
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Signup Trend */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              Signups (Last 30 Days)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <SignupTrendChart data={data.signupTrend} />
        </CardContent>
      </Card>

      {/* Engagement */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-medium text-muted-foreground">
            Engagement
          </h4>
        </div>
        <EngagementMetrics data={data.engagement} />
      </div>

      {/* Active Users */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ActiveUsersPanel data={data.activeUsers} />
        </CardContent>
      </Card>

      {/* Hourly Activity */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              Today&apos;s Activity by Hour (ET)
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <HourlyActivityChart data={data.hourlyActivity} />
        </CardContent>
      </Card>

      {/* Token Economy */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-400" />
          <h4 className="text-sm font-medium text-muted-foreground">
            Token Economy
          </h4>
        </div>
        <TokenEconomyPanel data={data.tokenEconomy} />
      </div>
    </div>
  );
}
