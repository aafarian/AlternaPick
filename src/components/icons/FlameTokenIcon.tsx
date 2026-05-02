import { cn } from "@/lib/utils";

interface FlameTokenIconProps {
  className?: string;
}

/**
 * Flame Token coin icon — a circular coin with a flame emblem.
 * Used for Flame Token balance, wagers, and payouts.
 * Distinct from the plain Flame icon used for HeatScore.
 */
export default function FlameTokenIcon({ className }: FlameTokenIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-4 w-4", className)}
    >
      {/* Coin body */}
      <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner ring */}
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.4" />
      {/* Flame emblem */}
      <path
        d="M12 6C12 6 9 9.5 9 12.5C9 14.5 10.3 16 12 16C13.7 16 15 14.5 15 12.5C15 9.5 12 6 12 6Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      <path
        d="M12 10C12 10 10.8 11.5 10.8 13C10.8 14 11.3 14.8 12 14.8C12.7 14.8 13.2 14 13.2 13C13.2 11.5 12 10 12 10Z"
        fill="currentColor"
        fillOpacity="0.3"
      />
    </svg>
  );
}
