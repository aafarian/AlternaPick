"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Circle, Bomb, Copy, Dice5, Target, Crown, type LucideIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "@/lib/motion";

const modes: { icon: LucideIcon; name: string; description: string }[] = [
  {
    icon: Circle,
    name: "Classic",
    description:
      "Standard head-to-head. Both players build their own card and the best record wins.",
  },
  {
    icon: Bomb,
    name: "Sabotage",
    description:
      "Build a card for your opponent. Try to saddle them with the worst lines possible.",
  },
  {
    icon: Copy,
    name: "Mirror",
    description:
      "Challenger picks the props, both players call over or under on the same lines.",
  },
  {
    icon: Dice5,
    name: "Random",
    description:
      "System picks your props. Just call over or under — pure instinct.",
  },
  {
    icon: Target,
    name: "One Player",
    description:
      "Every pick from a single player. How well do you really know your star?",
  },
  {
    icon: Crown,
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

  if (prefersReduced) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-20">
        {header}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modes.map((mode) => (
            <ModeCard key={mode.name} mode={mode} reduced />
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

function ModeCard({ mode, reduced = false }: { mode: (typeof modes)[number]; reduced?: boolean }) {
  const Icon = mode.icon;

  const card = (
    <Card className="group relative h-full overflow-hidden border-border bg-card/80 transition-colors hover:border-primary/30">
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-[-1px] rounded-[inherit] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
      </div>

      <CardContent className="relative flex flex-col gap-3 p-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 transition-all duration-300 group-hover:bg-primary/20 group-hover:shadow-[0_0_20px_rgba(0,210,106,0.15)]">
          <Icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
        </div>
        <h3 className="text-base font-bold">{mode.name}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {mode.description}
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
