"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/motion";
import { SlideUp } from "@/components/motion";

/**
 * Bottom CTA section — the final conversion touchpoint on the landing page.
 *
 * Sits below features and provides a compelling closing call-to-action
 * with a gradient panel, animated glow button, and social proof.
 * Uses ScrollReveal for viewport-triggered entrance animation.
 * Respects `prefers-reduced-motion` via the motion primitives.
 */
export function CTASection() {
  return (
    <ScrollReveal className="w-full max-w-4xl px-4 py-20">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 px-6 py-16 text-center sm:px-12">
        {/* Background glow orbs (CSS-only, decorative) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]"
        >
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.1)_0%,transparent_70%)] animate-hero-glow-1" />
          <div className="absolute right-0 top-0 h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_70%)] animate-hero-glow-2" />
        </div>

        {/* Headline */}
        <SlideUp delay={0.1} offset={16}>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Ready to{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              prove yourself
            </span>
            ?
          </h2>
        </SlideUp>

        {/* Supporting text */}
        <SlideUp delay={0.25} offset={12}>
          <p className="mx-auto mt-4 max-w-lg text-base text-muted-foreground sm:text-lg">
            No money, no risk — just you vs. your friends on real NBA player
            props. Make your picks and find out who really knows the game.
          </p>
        </SlideUp>

        {/* CTA button with animated glow */}
        <SlideUp delay={0.4} offset={12}>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Link href="/props">
              <Button
                size="lg"
                className="animate-cta-glow text-base font-bold transition-all duration-300 hover:scale-105"
              >
                Start Playing — It&apos;s Free
              </Button>
            </Link>

            {/* Social proof line */}
            <p className="text-sm text-muted-foreground">
              Join players already competing on{" "}
              <span className="font-semibold text-foreground">
                Sports Tower
              </span>
            </p>
          </div>
        </SlideUp>
      </section>
    </ScrollReveal>
  );
}
