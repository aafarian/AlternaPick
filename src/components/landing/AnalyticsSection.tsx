"use client";

import { BarChart3, TrendingUp, Target, Users, Flame } from "lucide-react";
import { ScrollReveal } from "@/components/motion";
import { motion, useReducedMotion } from "@/lib/motion";

const highlights = [
  {
    icon: BarChart3,
    label: "Category hit rates",
    detail: "See which stat types you dominate",
  },
  {
    icon: TrendingUp,
    label: "30-day trends",
    detail: "Track your performance over time",
  },
  {
    icon: Target,
    label: "Weekly Wrapped",
    detail: "Personalized recaps with achievement tiles",
  },
  {
    icon: Users,
    label: "Player & team breakdowns",
    detail: "Find which players and teams you read best",
  },
];

const mockBars = [
  { label: "Points", pct: 78 },
  { label: "Assists", pct: 71 },
  { label: "Rebounds", pct: 65 },
  { label: "3-Pointers", pct: 82 },
];

export function AnalyticsSection() {
  const prefersReduced = useReducedMotion();

  return (
    <section className="relative overflow-hidden py-20">
      {/* Subtle background accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-clip"
      >
        <div className="absolute left-0 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-2">
        {/* ── Text side ── */}
        <ScrollReveal>
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Track{" "}
              <span className="bg-gradient-to-r from-accent to-primary bg-clip-text text-transparent">
                Every Stat
              </span>
            </h2>
            <p className="text-muted-foreground">
              Your personal analytics dashboard breaks down your performance
              across every sport, stat category, and game mode. See
              what&apos;s working and where you can improve.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((h) => (
                <div key={h.label} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
                    <h.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{h.label}</p>
                    <p className="text-xs text-muted-foreground">{h.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* ── Mockup dashboard card ── */}
        <ScrollReveal>
          <motion.div
            className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm transition-colors hover:border-primary/30"
            whileHover={prefersReduced ? undefined : { scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
          >
            <p className="mb-4 text-sm font-semibold text-muted-foreground">
              Your Analytics
            </p>

            {/* Top stats row */}
            <div className="mb-6 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-black text-primary">72.3%</p>
                <p className="text-xs text-muted-foreground">Hit Rate</p>
              </div>
              <div>
                <p className="text-2xl font-black">156</p>
                <p className="text-xs text-muted-foreground">Cards Played</p>
              </div>
              <div>
                <p className="flex items-center justify-center gap-1 text-2xl font-black text-accent"><Flame className="h-5 w-5" /> 5</p>
                <p className="text-xs text-muted-foreground">Streak</p>
              </div>
            </div>

            {/* Mini bar chart */}
            <div className="space-y-3">
              {mockBars.map((bar) => (
                <div key={bar.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{bar.label}</span>
                    <span className="font-semibold">{bar.pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${bar.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </ScrollReveal>
      </div>
    </section>
  );
}
