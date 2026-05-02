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
        d="M12 5C12 5 9 8 8.5 11C8 13.5 9.5 16.5 12 16.5C14.5 16.5 16 13.5 15.5 11C15.2 9.5 14 8 13.8 7.5C13.5 8.5 13 9.2 12.3 9.5C12.3 9.5 13 7 12 5Z"
        fill="#ea580c"
      />
      {/* Middle flame — orange */}
      <path
        d="M12 7.5C12 7.5 9.8 10 9.8 12.5C9.8 14.5 10.8 15.8 12 15.8C13.2 15.8 14.2 14.5 14.2 12.5C14.2 11.5 13.5 10 13.2 9.5C13 10.2 12.6 10.5 12.2 10.5C12.2 10.5 12.8 8.8 12 7.5Z"
        fill="#f97316"
      />
      {/* Inner flame — yellow bright core */}
      <path
        d="M12 10.5C12 10.5 10.8 12 10.8 13.5C10.8 14.6 11.3 15.2 12 15.2C12.7 15.2 13.2 14.6 13.2 13.5C13.2 12 12 10.5 12 10.5Z"
        fill="#fbbf24"
      />
      {/* Bright tip */}
      <path
        d="M12 12.5C12 12.5 11.3 13.5 11.3 14.2C11.3 14.7 11.6 15 12 15C12.4 15 12.7 14.7 12.7 14.2C12.7 13.5 12 12.5 12 12.5Z"
        fill="#fef3c7"
      />
    </svg>
  );
}
