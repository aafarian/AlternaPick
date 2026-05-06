"use client";

import { ScrollReveal } from "@/components/motion";
import { Flame, TrendingUp, Shield, Zap } from "lucide-react";

const highlights = [
  {
    icon: Flame,
    title: "Wager virtual coins",
    description: "Start with free Flame Coins and wager them on your picks. Win more by hitting your predictions.",
  },
  {
    icon: TrendingUp,
    title: "Payout multipliers",
    description: "Hit all your picks for up to 10x returns. Miss and you bust. The more picks, the bigger the risk and reward.",
  },
  {
    icon: Zap,
    title: "Difficulty tiers",
    description: "Shift your lines from Frosty (easy) to Volcanic (near-impossible). Harder picks earn bigger multiplier bonuses.",
  },
  {
    icon: Shield,
    title: "Zero real money",
    description: "It feels like real stakes, but your wallet is safe. Compete for leaderboard glory and bragging rights.",
  },
];

export function FlameTokensSection() {
  return (
    <section className="relative overflow-hidden py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-clip"
      >
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(249,115,22,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <ScrollReveal>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Flame{" "}
              <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                Coins
              </span>
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
              All the thrill of wagering — with zero financial risk.
              Earn coins, wager them on your picks, and chase massive multipliers.
            </p>
          </div>
        </ScrollReveal>

        {/* Mock wager display */}
        <ScrollReveal className="mb-12">
          <div className="mx-auto max-w-md rounded-xl border border-orange-500/30 bg-card/80 p-6 backdrop-blur-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-orange-400">
                <Flame className="h-4 w-4" />
                Wager
              </span>
              <span className="text-xs text-muted-foreground">2,500 available</span>
            </div>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-md border border-orange-500/40 bg-background px-3 py-1.5 text-lg font-bold text-orange-400">
                100
              </div>
              <div className="flex gap-1">
                {[25, 50, 100].map((amt) => (
                  <span
                    key={amt}
                    className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                      amt === 100
                        ? "bg-orange-500/20 text-orange-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {amt}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-3 rounded-md border border-border/60 px-1 py-1">
              {[
                { picks: "4/4", mult: "5x", payout: "+400", color: "text-orange-400" },
                { picks: "3/4", mult: "1.5x", payout: "+50", color: "text-emerald-500" },
                { picks: "2/4", mult: "—", payout: "Bust", color: "text-red-400" },
              ].map((tier) => (
                <div key={tier.picks} className="flex flex-1 flex-col items-center py-1.5">
                  <span className="text-[10px] text-muted-foreground">{tier.picks}</span>
                  <span className={`text-xs font-bold ${tier.color}`}>{tier.mult}</span>
                  <span className={`text-[10px] ${tier.color}`}>{tier.payout}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Feature grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={item.title}>
                <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm transition-colors hover:border-orange-500/30">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                    <Icon className="h-5 w-5 text-orange-400" />
                  </div>
                  <h3 className="text-sm font-bold">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
