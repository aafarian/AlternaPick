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
 * Full-viewport hero with ambient glow orbs.
 *
 * Glow container has NO overflow-hidden so the radial gradients
 * bleed naturally to viewport edges — no visible box.
 */
export default function HeroSection() {
  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center gap-6 px-4 text-center">
      {/* ── Background glow orbs (no overflow-hidden → no visible box) ── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        {/* Primary green — large, top-center, pushed well above fold so edge is never visible */}
        <div className="absolute left-1/2 top-0 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-[40%] rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.18)_0%,transparent_60%)] animate-hero-glow-1" />
        {/* Accent blue — offset right */}
        <div className="absolute right-0 top-1/3 h-[600px] w-[600px] translate-x-[20%] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)] animate-hero-glow-2" />
        {/* Dim green — offset left, lower */}
        <div className="absolute left-0 bottom-0 h-[500px] w-[500px] -translate-x-[20%] translate-y-[20%] rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.10)_0%,transparent_70%)] animate-hero-glow-3" />
      </div>

      {/* ── Badge ── */}
      <ScaleIn delay={0.1} duration={0.5} initialScale={0.85} className="mb-2">
        <div className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-primary shadow-[0_0_20px_rgba(0,210,106,0.15)]">
          Free to play
        </div>
      </ScaleIn>

      {/* ── Headline ── */}
      <StaggerChildren staggerDelay={0.12} className="max-w-4xl">
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl">
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
      <FadeIn delay={0.65} duration={0.6} className="max-w-2xl">
        <p className="text-lg text-muted-foreground sm:text-xl">
          Pick over/unders on real player props across NBA, college basketball,
          soccer, and more. Challenge friends head-to-head and prove who really
          knows the game.
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
              Challenge a Friend
            </Button>
          </Link>
        </div>
      </SlideUp>

    </section>
  );
}
