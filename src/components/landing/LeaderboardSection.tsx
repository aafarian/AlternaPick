"use client";

import { Globe, Users, Swords, Flame } from "lucide-react";
import { ScrollReveal } from "@/components/motion";

const highlights = [
  {
    icon: Globe,
    label: "Global rankings",
    detail: "Compete with all players platform-wide",
  },
  {
    icon: Users,
    label: "Friends board",
    detail: "See where you rank in your circle",
  },
  {
    icon: Swords,
    label: "H2H records",
    detail: "Track your head-to-head wins and losses",
  },
  {
    icon: Flame,
    label: "Win streaks",
    detail: "Build momentum and hold your streak",
  },
];

const mockLeaderboard = [
  { rank: 1, name: "PropsKing", rate: "74.2%", medal: "🥇" },
  { rank: 2, name: "StatGuru", rate: "71.8%", medal: "🥈" },
  { rank: 3, name: "BetMaster", rate: "69.5%", medal: "🥉" },
  { rank: 4, name: "SlamDunk", rate: "68.1%", medal: undefined },
  { rank: 5, name: "GridIron", rate: "67.3%", medal: undefined },
];

export function LeaderboardSection() {
  return (
    <section className="relative overflow-hidden py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.06)_0%,transparent_70%)]" />
      </div>

      <div className="mx-auto grid max-w-5xl items-center gap-12 px-4 md:grid-cols-2">
        {/* ── Mockup leaderboard card (left on desktop) ── */}
        <ScrollReveal className="order-2 md:order-1">
          <div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
            <p className="mb-4 text-sm font-semibold text-muted-foreground">
              Global Leaderboard
            </p>

            <div className="space-y-2">
              {mockLeaderboard.map((player) => (
                <div
                  key={player.rank}
                  className={`flex items-center justify-between rounded-lg px-3 py-2.5 ${
                    player.rank <= 3 ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center text-sm font-bold text-muted-foreground">
                      {player.medal ?? player.rank}
                    </span>
                    <span className="text-sm font-semibold">
                      {player.name}
                    </span>
                  </div>
                  <span
                    className={`text-sm font-bold ${
                      player.rank === 1 ? "text-primary" : ""
                    }`}
                  >
                    {player.rate}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* ── Text side (right on desktop) ── */}
        <ScrollReveal className="order-1 md:order-2">
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              Compete{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Globally
              </span>
            </h2>
            <p className="text-muted-foreground">
              See where you stand among all players or just your friends. Two
              leaderboards, two ranking systems — hit rate and head-to-head
              record.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              {highlights.map((h) => (
                <div key={h.label} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <h.icon className="h-4 w-4 text-primary" />
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
      </div>
    </section>
  );
}
