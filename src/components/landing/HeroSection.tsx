"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ScaleIn,
  SlideUp,
  FadeIn,
  StaggerChildren,
  StaggerItem,
} from "@/components/motion";

/**
 * Animated hero section for the landing page.
 *
 * Orchestrated entrance: badge -> headline words -> subtitle -> CTA buttons.
 * Background glow orbs are pure CSS animations for zero JS overhead.
 * Respects `prefers-reduced-motion` via the motion primitives.
 */
export default function HeroSection() {
  return (
    <section className="relative flex flex-col items-center gap-6 py-24 text-center overflow-hidden">
      {/* ── Background glow orbs (CSS-only) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        {/* Primary green orb — top center */}
        <div className="absolute left-1/2 top-1/4 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.15)_0%,transparent_70%)] animate-hero-glow-1" />
        {/* Accent blue orb — offset right */}
        <div className="absolute left-2/3 top-1/2 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)] animate-hero-glow-2" />
        {/* Dim green orb — offset left, lower */}
        <div className="absolute left-1/3 top-2/3 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.08)_0%,transparent_70%)] animate-hero-glow-3" />
      </div>

      {/* ── Badge ── */}
      <ScaleIn delay={0.1} duration={0.5} initialScale={0.85} className="mb-2">
        <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary shadow-[0_0_20px_rgba(0,210,106,0.15)]">
          Free to play
        </div>
      </ScaleIn>

      {/* ── Headline with staggered word reveal ── */}
      <StaggerChildren staggerDelay={0.12} className="max-w-3xl">
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          <StaggerItem>
            <span className="inline-block">Predict.</span>
          </StaggerItem>{" "}
          <StaggerItem>
            <span className="inline-block">Compete.</span>
          </StaggerItem>{" "}
          <StaggerItem>
            <span className="inline-block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Dominate.
            </span>
          </StaggerItem>
        </h1>
      </StaggerChildren>

      {/* ── Subtitle ── */}
      <FadeIn delay={0.65} duration={0.6} className="max-w-xl">
        <p className="text-lg text-muted-foreground">
          Pick over/unders on real NBA player props, challenge your friends
          head-to-head, and see who really knows the game. No money — just
          bragging rights.
        </p>
      </FadeIn>

      {/* ── CTA Buttons ── */}
      <SlideUp delay={0.9} duration={0.5} offset={20} className="mt-6">
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/props">
            <Button
              size="lg"
              className="text-base font-bold shadow-[0_0_25px_rgba(0,210,106,0.25)] transition-all duration-300 hover:shadow-[0_0_40px_rgba(0,210,106,0.4)] hover:scale-105"
            >
              Make Your Picks
            </Button>
          </Link>
          <Link href="/challenges">
            <Button
              variant="outline"
              size="lg"
              className="text-base font-bold transition-all duration-300 hover:border-accent/50 hover:shadow-[0_0_25px_rgba(59,130,246,0.2)] hover:scale-105"
            >
              Challenge Friends
            </Button>
          </Link>
        </div>
      </SlideUp>
    </section>
  );
}
