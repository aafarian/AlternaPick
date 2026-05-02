import { cn } from "@/lib/utils";

interface FlameTokenIconProps {
  className?: string;
}

/**
 * Flame Token coin icon — a circular coin with a colored flame emblem.
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
      <circle cx="12" cy="12" r="10" fill="#f97316" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
      {/* Inner ring */}
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="0.75" strokeOpacity="0.3" />
      {/* Outer flame — red/orange base with multiple tips */}
      <path
        d="M12 6C12 6 9 9 8.5 12C8 14.5 9.5 17.5 12 17.5C14.5 17.5 16 14.5 15.5 12C15.2 10.5 14 9 13.8 8.5C13.5 9.5 13 10.2 12.3 10.5C12.3 10.5 13 8 12 6Z"
        fill="#ea580c"
      />
      {/* Middle flame — orange */}
      <path
        d="M12 8.5C12 8.5 9.8 11 9.8 13.5C9.8 15.5 10.8 16.8 12 16.8C13.2 16.8 14.2 15.5 14.2 13.5C14.2 12.5 13.5 11 13.2 10.5C13 11.2 12.6 11.5 12.2 11.5C12.2 11.5 12.8 9.8 12 8.5Z"
        fill="#f97316"
      />
      {/* Inner flame — yellow bright core */}
      <path
        d="M12 11.5C12 11.5 10.8 13 10.8 14.5C10.8 15.6 11.3 16.2 12 16.2C12.7 16.2 13.2 15.6 13.2 14.5C13.2 13 12 11.5 12 11.5Z"
        fill="#fbbf24"
      />
      {/* Bright tip */}
      <path
        d="M12 13.5C12 13.5 11.3 14.5 11.3 15.2C11.3 15.7 11.6 16 12 16C12.4 16 12.7 15.7 12.7 15.2C12.7 14.5 12 13.5 12 13.5Z"
        fill="#fef3c7"
      />
    </svg>
  );
}
