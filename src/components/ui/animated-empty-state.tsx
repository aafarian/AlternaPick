"use client";

import { type ReactNode } from "react";
import { useReducedMotion } from "@/lib/motion";
import { ScaleIn, FadeIn } from "@/components/motion";
import { cn } from "@/lib/utils";

interface AnimatedEmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * A polished, animated empty-state card used when a list has no items.
 *
 * Sequenced entrance: icon scales in with a bounce, title fades in,
 * description fades in, and the action CTA scales in last.
 * A subtle pulsing border glow (card-border-glow keyframe) is applied.
 *
 * Respects `prefers-reduced-motion` — renders everything immediately
 * with no animation and a static glow fallback.
 */
export function AnimatedEmptyState({
  icon,
  title,
  description,
  action,
  className,
}: AnimatedEmptyStateProps) {
  const prefersReduced = useReducedMotion();

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-8 text-center",
        !prefersReduced && "card-border-glow",
        className,
      )}
      style={
        !prefersReduced
          ? { animation: "card-border-glow 3s ease-in-out infinite" }
          : undefined
      }
    >
      {/* Icon — scales in with a bounce */}
      <ScaleIn delay={0} duration={0.5} initialScale={0.5}>
        <div className="flex items-center justify-center text-muted-foreground" aria-hidden="true">
          {typeof icon === "string" ? (
            <span className="text-4xl">{icon}</span>
          ) : (
            icon
          )}
        </div>
      </ScaleIn>

      {/* Title — fades in after icon */}
      <FadeIn delay={0.15} duration={0.4}>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </FadeIn>

      {/* Description — fades in after title */}
      {description && (
        <FadeIn delay={0.3} duration={0.4}>
          <p className="max-w-xs text-sm text-muted-foreground">
            {description}
          </p>
        </FadeIn>
      )}

      {/* Action CTA — scales in last */}
      {action && (
        <ScaleIn delay={0.45} duration={0.4} initialScale={0.9}>
          <div className="mt-1">{action}</div>
        </ScaleIn>
      )}
    </div>
  );
}
