import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Swords, Trophy } from "lucide-react";

const features = [
  {
    title: "Pick Over/Unders",
    description:
      "Browse tonight's NBA player props and lock in your predictions. Points, rebounds, assists, and more.",
    icon: Target,
  },
  {
    title: "Challenge Friends",
    description:
      "Go head-to-head with your friends. You both pick 6 — see who knows the game better.",
    icon: Swords,
  },
  {
    title: "Climb the Leaderboard",
    description:
      "Track your win rate, build streaks, and prove you're the best predictor in your crew.",
    icon: Trophy,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 py-24 text-center">
        <div className="mb-2 inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary">
          Free to play
        </div>
        <h1 className="max-w-3xl text-5xl font-black tracking-tight sm:text-7xl">
          Predict. Compete.{" "}
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dominate.
          </span>
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Pick over/unders on real NBA player props, challenge your friends
          head-to-head, and see who really knows the game. No money — just
          bragging rights.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link href="/props">
            <Button size="lg" className="text-base font-bold shadow-[0_0_25px_rgba(0,210,106,0.25)]">
              Make Your Picks
            </Button>
          </Link>
          <Link href="/challenges">
            <Button variant="outline" size="lg" className="text-base font-bold">
              Challenge Friends
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid w-full max-w-4xl gap-6 py-12 sm:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card
              key={feature.title}
              className="group border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(0,210,106,0.08)]"
            >
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
