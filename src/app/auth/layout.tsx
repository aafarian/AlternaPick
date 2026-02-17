"use client";

import { ScaleIn, FadeIn } from "@/components/motion";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-full max-w-md">
        {/* ── Ambient glow orb behind brand text ── */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,rgba(0,210,106,0.14)_0%,rgba(59,130,246,0.07)_50%,transparent_70%)] animate-auth-glow"
        />

        {/* ── Brand heading ── */}
        <div className="mb-8 text-center">
          <ScaleIn duration={0.5} initialScale={0.85}>
            <h1 className="text-3xl font-bold">
              <span className="text-primary">Alterna</span> Pick
            </h1>
          </ScaleIn>

          <FadeIn delay={0.35} duration={0.5}>
            <p className="mt-2 text-sm text-muted-foreground">
              Predict. Compete. Dominate.
            </p>
          </FadeIn>
        </div>

        {/* ── Form area (login / signup) ── */}
        <FadeIn delay={0.55} duration={0.5}>
          {children}
        </FadeIn>
      </div>
    </div>
  );
}
