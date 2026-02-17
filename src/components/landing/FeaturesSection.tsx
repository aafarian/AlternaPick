"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Swords, Trophy, type LucideIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "@/lib/motion";

const features: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "Pick Over/Unders",
    description:
      "Browse real player props across NBA, college basketball, Premier League, La Liga, and more. Lock in your predictions on points, assists, goals, and dozens of other stats.",
    icon: Target,
  },
  {
    title: "Challenge Friends",
    description:
      "Go head-to-head in 6 unique game modes — from Classic to Sabotage. Send a challenge, both make your picks, and see who comes out on top.",
    icon: Swords,
  },
  {
    title: "Climb the Leaderboard",
    description:
      "Track your hit rate, build win streaks, and climb the global rankings. Compare stats with friends or compete for the #1 spot.",
    icon: Trophy,
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.15 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.2, once: true });
  const prefersReduced = useReducedMotion();

  const header = (
    <div className="mb-12 text-center">
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
        How It{" "}
        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Works
        </span>
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
        Three steps to getting in the game. No money, no risk — just bragging
        rights.
      </p>
    </div>
  );

  if (prefersReduced) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-20">
        {header}
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} feature={feature} reduced />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      {header}
      <motion.div
        ref={ref}
        className="grid gap-6 sm:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {features.map((feature) => (
          <motion.div key={feature.title} variants={cardVariants}>
            <FeatureCard feature={feature} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function FeatureCard({
  feature,
  reduced = false,
}: {
  feature: (typeof features)[number];
  reduced?: boolean;
}) {
  const Icon = feature.icon;

  const card = (
    <Card className="group relative h-full overflow-hidden border-border bg-card/80 backdrop-blur-sm transition-colors hover:border-primary/40">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-[-1px] rounded-[inherit] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
      </div>

      <CardContent className="relative flex flex-col gap-3 p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_rgba(0,210,106,0.15)]">
          <Icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
        </div>

        <h3 className="text-lg font-bold">{feature.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </CardContent>
    </Card>
  );

  if (reduced) return card;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="h-full"
    >
      {card}
    </motion.div>
  );
}
