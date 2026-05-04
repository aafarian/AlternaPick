"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, TrendingDown, Coins, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import type { TokenEconomyStats } from "@/lib/admin/types";

interface TokenEconomyPanelProps {
  data: TokenEconomyStats;
}

export default function TokenEconomyPanel({ data }: TokenEconomyPanelProps) {
  const netPositive = data.netTokenFlow >= 0;

  const statCards = [
    {
      label: "Wagered Today",
      value: data.totalWageredToday.toLocaleString(),
      icon: Coins,
      color: "text-orange-400",
    },
    {
      label: "Payouts Today",
      value: data.totalPayoutsToday.toLocaleString(),
      icon: CircleDollarSign,
      color: "text-emerald-500",
    },
    {
      label: "Net Token Flow",
      value: `${netPositive ? "+" : ""}${data.netTokenFlow.toLocaleString()}`,
      icon: netPositive ? TrendingDown : TrendingUp,
      color: netPositive ? "text-emerald-500" : "text-red-400",
      subtitle: netPositive ? "Deflationary (healthy)" : "Inflationary",
    },
    {
      label: "Circulating Supply",
      value: data.totalCirculatingTokens.toLocaleString(),
      icon: FlameTokenIcon,
      color: "text-orange-400",
      subtitle: data.avgWagerSize > 0
        ? `Avg wager: ${data.avgWagerSize}`
        : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="py-4">
              <CardHeader className="px-4 pb-0 pt-0 gap-1">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", c.color)} />
                  <CardTitle className="text-xs font-medium text-muted-foreground">
                    {c.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="px-4 pt-1 pb-0">
                <p className={cn("text-2xl font-bold tracking-tight", c.color)}>
                  {c.value}
                </p>
                {c.subtitle && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.subtitle}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.topWagerers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            Top Wagerers Today
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Wagered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topWagerers.map((w, i) => (
                <TableRow key={w.username}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium">{w.username}</TableCell>
                  <TableCell className="text-right tabular-nums text-orange-400">
                    {w.wageredToday.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
