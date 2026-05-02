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
      {/* Flame emblem — asymmetric with flickering tip */}
      <path
        d="M12 5.5C12 5.5 8.5 9 8.5 12.5C8.5 14.8 10 16.5 12 16.5C14 16.5 15.5 14.8 15.5 12.5C15.5 11 14.5 9.5 14 8.5C13.5 9.5 13 10 12.5 10C12.5 10 13.5 7.5 12 5.5Z"
        fill="currentColor"
        fillOpacity="0.9"
      />
      {/* Inner bright core */}
      <path
        d="M12 11C12 11 10.5 12.5 10.5 13.8C10.5 14.8 11.2 15.5 12 15.5C12.8 15.5 13.5 14.8 13.5 13.8C13.5 12.5 12 11 12 11Z"
        fill="currentColor"
        fillOpacity="0.25"
      />
    </svg>
  );
}
