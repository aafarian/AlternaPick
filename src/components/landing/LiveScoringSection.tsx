"use client";

import { ScrollReveal } from "@/components/motion";
import { Radio, Eye, BarChart3, Bell } from "lucide-react";

const features = [
  {
    icon: Radio,
    title: "Real-time scores",
    description: "Live game scores update as they happen — no refreshing needed.",
  },
  {
    icon: Eye,
    title: "Watch picks resolve",
    description: "Progress bars fill in real time as player stats accumulate during the game.",
  },
  {
    icon: BarChart3,
    title: "Live stat tracking",
    description: "See exactly how close each pick is to hitting with live stat values and margins.",
  },
  {
    icon: Bell,
    title: "Instant results",
    description: "Get notified when your card resolves. See your score, payout, and quality bonus.",
  },
];

export function LiveScoringSection() {
  return (
    <section className="relative overflow-hidden py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-clip"
      >
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] translate-x-1/4 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-2">
        {/* Mock live card */}
        <ScrollReveal className="order-2 md:order-1">
          <div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-bold text-emerald-500">LIVE</span>
              </div>
              <span className="text-xs text-muted-foreground">PHI 98 — 91 BOS · Q4 3:42</span>
            </div>

            {/* Mock pick rows */}
            {[
              { player: "Tyrese Maxey", stat: "Points", line: 24.5, current: 28, hit: true, pct: 100 },
              { player: "Jaylen Brown", stat: "Rebounds", line: 5.5, current: 4, hit: false, pct: 72 },
              { player: "Joel Embiid", stat: "Assists", line: 3.5, current: 3, hit: false, pct: 86 },
            ].map((pick) => (
              <div key={pick.player} className="mb-2 last:mb-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium">{pick.player}</span>
                  <span className="text-xs text-muted-foreground">
                    {pick.stat} O {pick.line}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pick.hit ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${pick.pct}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold tabular-nums ${
                    pick.hit ? "text-emerald-500" : "text-foreground"
                  }`}>
                    {pick.current}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>

        {/* Text side */}
        <ScrollReveal className="order-1 md:order-2">
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Watch It{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-primary bg-clip-text text-transparent">
                Happen Live
              </span>
            </h2>
            <p className="text-muted-foreground">
              Your picks aren&apos;t just numbers on a page. Watch progress bars
              fill in real time as games unfold. See live scores, stat updates,
              and know exactly where you stand — all without refreshing.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{f.title}</p>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
