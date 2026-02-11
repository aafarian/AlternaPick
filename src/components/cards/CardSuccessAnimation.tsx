"use client";

import { useEffect } from "react";

interface CardSuccessAnimationProps {
  onDismiss: () => void;
}

/** Confetti particle colors (neon-green, electric-blue, white, gold) */
const PARTICLE_COLORS = [
  "bg-neon-green",
  "bg-electric-blue",
  "bg-white",
  "bg-amber-400",
  "bg-neon-green",
  "bg-electric-blue",
];

/**
 * Celebratory overlay that plays after a successful card lock-in.
 * CSS-only animation: confetti-like particles + "Card Locked!" text.
 * Auto-dismisses after 2.5 seconds.
 */
export default function CardSuccessAnimation({
  onDismiss,
}: CardSuccessAnimationProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 2500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden pointer-events-none">
      {/* Semi-transparent backdrop */}
      <div className="absolute inset-0 bg-background/60 animate-success-fade-in" />

      {/* Confetti particles */}
      {Array.from({ length: 24 }).map((_, i) => {
        const colorClass = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
        const size = 6 + (i % 4) * 2; // 6-12px
        const startX = 50 + (i % 5 - 2) * 8; // spread around center
        const driftX = (i % 7 - 3) * 30; // horizontal drift
        const delay = (i * 80) % 600; // stagger within 600ms
        const duration = 1400 + (i % 5) * 200; // 1.4-2.2s
        const rotation = (i % 3) * 120; // initial rotation variance

        return (
          <div
            key={i}
            className={`absolute rounded-sm ${colorClass} opacity-0`}
            style={{
              width: `${size}px`,
              height: `${size}px`,
              left: `${startX}%`,
              top: "50%",
              animationName: "success-confetti",
              animationDuration: `${duration}ms`,
              animationDelay: `${delay}ms`,
              animationTimingFunction: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              animationFillMode: "forwards",
              "--drift-x": `${driftX}px`,
              "--rotation": `${rotation}deg`,
            } as React.CSSProperties}
          />
        );
      })}

      {/* Central text + checkmark */}
      <div className="relative flex flex-col items-center gap-3 animate-success-pop">
        {/* Checkmark circle */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neon-green/20 ring-2 ring-neon-green/40">
          <svg
            className="h-9 w-9 text-neon-green animate-success-check"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M5 13l4 4L19 7"
              strokeDasharray="24"
              strokeDashoffset="24"
              style={{
                animation: "success-draw-check 0.5s 0.3s ease forwards",
              }}
            />
          </svg>
        </div>

        {/* Text */}
        <span className="text-2xl font-extrabold tracking-tight text-foreground drop-shadow-lg">
          Card Locked!
        </span>
        <span className="text-sm text-muted-foreground">
          Good luck!
        </span>
      </div>
    </div>
  );
}
