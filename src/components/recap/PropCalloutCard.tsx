"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/constants";
import { AlertTriangle, Lock } from "lucide-react";
import type { TrapOrLockProp } from "@/lib/recaps/compute";

interface PropCalloutCardProps {
  props: TrapOrLockProp[];
  variant: "trap" | "lock";
}

const MAX_DISPLAY = 5;

const variantConfig = {
  trap: {
    icon: AlertTriangle,
    title: "Trap Props",
    subtitle: "These props fooled the most pickers",
    borderClass: "border-bold-red/30",
    bgClass: "bg-bold-red/5",
    iconBgClass: "bg-bold-red/10",
    iconTextClass: "text-bold-red",
    rateClass: "text-bold-red",
    badgeBgClass: "bg-bold-red/15 text-bold-red border-bold-red/30",
    rowBgClass: "bg-bold-red/5",
    formatLabel: (rate: number) => `${Math.round(rate * 100)}% of pickers got this wrong`,
  },
  lock: {
    icon: Lock,
    title: "Lock Props",
    subtitle: "Free money — almost everyone hit these",
    borderClass: "border-neon-green/30",
    bgClass: "bg-neon-green/5",
    iconBgClass: "bg-neon-green/10",
    iconTextClass: "text-neon-green",
    rateClass: "text-neon-green",
    badgeBgClass: "bg-neon-green/15 text-neon-green border-neon-green/30",
    rowBgClass: "bg-neon-green/5",
    formatLabel: (rate: number) => `${Math.round(rate * 100)}% of pickers nailed this`,
  },
} as const;

export function PropCalloutCard({ props, variant }: PropCalloutCardProps) {
  if (props.length === 0) return null;

  const config = variantConfig[variant];
  const Icon = config.icon;
  const displayProps = props.slice(0, MAX_DISPLAY);

  return (
    <Card className={`${config.borderClass} ${config.bgClass}`}>
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full ${config.iconBgClass}`}
          >
            <Icon className={`h-4 w-4 ${config.iconTextClass}`} />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">{config.title}</h2>
            <p className="text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
          <Badge className={`ml-auto shrink-0 text-[10px] ${config.badgeBgClass}`}>
            {displayProps.length} prop{displayProps.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Prop Rows */}
        <div className="mt-4 flex flex-col gap-2">
          {displayProps.map((prop) => {
            const categoryLabel =
              CATEGORY_LABELS[prop.statCategory] ?? prop.statCategory;
            const hitPercent = Math.round(prop.hitRate * 100);

            return (
              <div
                key={prop.propId}
                className={`rounded-lg ${config.rowBgClass} px-3 py-2.5`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {prop.playerName}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {prop.line} {categoryLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-bold tabular-nums ${config.rateClass}`}>
                      {hitPercent}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {prop.pickCount} pick{prop.pickCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {config.formatLabel(variant === "trap" ? 1 - prop.hitRate : prop.hitRate)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
