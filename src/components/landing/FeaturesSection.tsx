"use client";

import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, Swords, Trophy, type LucideIcon } from "lucide-react";
import { motion, useInView, useReducedMotion } from "@/lib/motion";

const features: { title: string; description: string; icon: LucideIcon }[] = [
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

/* ── Stagger variants (scroll-triggered) ── */
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

  /* Reduced motion: render instantly, no animation */
  if (prefersReduced) {
    return (
      <section className="grid w-full max-w-4xl gap-6 py-12 sm:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} reduced />
        ))}
      </section>
    );
  }

  return (
    <motion.section
      ref={ref}
      className="grid w-full max-w-4xl gap-6 py-12 sm:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {features.map((feature) => (
        <motion.div key={feature.title} variants={cardVariants}>
          <FeatureCard feature={feature} />
        </motion.div>
      ))}
    </motion.section>
  );
}

/* ── Individual feature card ── */

function FeatureCard({
  feature,
  reduced = false,
}: {
  feature: (typeof features)[number];
  reduced?: boolean;
}) {
  const Icon = feature.icon;

  const card = (
    <Card className="group relative overflow-hidden border-border bg-card/80 backdrop-blur-sm transition-colors hover:border-primary/40">
      {/* Gradient border glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute inset-[-1px] rounded-[inherit] bg-gradient-to-br from-primary/20 via-accent/10 to-transparent" />
      </div>

      <CardContent className="relative flex flex-col gap-3 p-6">
        {/* Icon container with glow on hover */}
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

  /* When reduced motion is preferred, skip the hover scale wrapper */
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
