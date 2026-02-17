"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useInView, useReducedMotion } from "@/lib/motion";

const modes = [
  {
    icon: "🏀",
    name: "Classic",
    description:
      "Standard head-to-head. Both players build their own card and the best record wins.",
  },
  {
    icon: "💣",
    name: "Sabotage",
    description:
      "Build a card for your opponent. Try to saddle them with the worst lines possible.",
  },
  {
    icon: "🪞",
    name: "Mirror",
    description:
      "Challenger picks the props, both players call over or under on the same lines.",
  },
  {
    icon: "🎲",
    name: "Random",
    description:
      "System picks your props. Just call over or under — pure instinct.",
  },
  {
    icon: "🎯",
    name: "One Player",
    description:
      "Every pick from a single player. How well do you really know your star?",
  },
  {
    icon: "👑",
    name: "One Team",
    description:
      "Lock in on one squad. Every pick from players on the same team.",
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" as const },
  },
};

export function GameModesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.1, once: true });
  const prefersReduced = useReducedMotion();

  const header = (
    <div className="mb-12 text-center">
      <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
        6 Ways to{" "}
        <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Play
        </span>
      </h2>
      <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
        From strategic sabotage to pure luck of the draw — there&apos;s a mode
        for every type of competitor.
      </p>
    </div>
  );

  const cards = modes.map((mode) => (
    <ModeCard key={mode.name} mode={mode} />
  ));

  if (prefersReduced) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-20">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      {header}
      <motion.div
        ref={ref}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
      >
        {modes.map((mode) => (
          <motion.div key={mode.name} variants={cardVariants}>
            <ModeCard mode={mode} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

function ModeCard({ mode }: { mode: (typeof modes)[number] }) {
  return (
    <Card className="group border-border bg-card/80 transition-colors hover:border-primary/30">
      <CardContent className="flex flex-col gap-3 p-5">
        <span className="text-2xl">{mode.icon}</span>
        <h3 className="text-base font-bold">{mode.name}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {mode.description}
        </p>
      </CardContent>
    </Card>
  );
}
