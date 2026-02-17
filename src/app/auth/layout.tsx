"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { ScaleIn, FadeIn } from "@/components/motion";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  // Hide the entire auth chrome while checking auth or after sign-in
  // so the brand heading doesn't flash alone during redirect.
  if (loading || user) return <>{children}</>;

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="relative w-full max-w-md">
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
