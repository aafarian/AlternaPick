"use client";

import { useState } from "react";
import Link from "next/link";
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

function WagerTabs({ data }: { data: TokenEconomyStats }) {
  const [tab, setTab] = useState<"top" | "cards">("top");

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("top")}
          className={cn(
            "text-xs font-semibold transition-colors",
            tab === "top" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Top Wagerers
        </button>
        <span className="text-muted-foreground/30">|</span>
        <button
          type="button"
          onClick={() => setTab("cards")}
          className={cn(
            "text-xs font-semibold transition-colors",
            tab === "cards" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
        >
          All Wagers
        </button>
      </div>

      {tab === "top" ? (
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
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Card</TableHead>
              <TableHead className="text-right">Wager</TableHead>
              <TableHead className="text-right">Payout</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.wageredCards.map((c) => (
              <TableRow key={c.cardId}>
                <TableCell className="font-medium">{c.username}</TableCell>
                <TableCell>
                  <Link href={`/admin/lookup/card/${c.cardId}`} className="text-xs text-primary hover:underline">
                    {c.cardSize}-pick {c.gameMode}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums text-orange-400">
                  {c.wager}
                </TableCell>
                <TableCell className={cn(
                  "text-right tabular-nums",
                  c.payout != null && c.payout > 0 ? "text-emerald-500" : "text-muted-foreground"
                )}>
                  {c.payout != null ? c.payout : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
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

      {(data.topWagerers.length > 0 || data.wageredCards.length > 0) && (
        <WagerTabs data={data} />
      )}
    </div>
  );
}
