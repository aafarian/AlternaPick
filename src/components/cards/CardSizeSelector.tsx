"use client";

import { CARD_SIZES } from "@/lib/modes/types";
import { cn } from "@/lib/utils";

interface CardSizeSelectorProps {
  activeSize: number;
  onSelect: (size: number) => void;
  disabled?: boolean;
}

export default function CardSizeSelector({
  activeSize,
  onSelect,
  disabled = false,
}: CardSizeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Number of Picks
      </span>
      <div className="flex gap-2">
        {CARD_SIZES.map((size) => {
          const isActive = activeSize === size;

          return (
            <button
              key={size}
              onClick={() => onSelect(size)}
              disabled={disabled}
              className={cn(
                "flex h-9 w-12 items-center justify-center rounded-lg border text-sm font-bold transition-all",
                "hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-neon-green bg-neon-green/10 text-neon-green shadow-[0_0_12px_rgba(0,210,106,0.2)]"
                  : "border-border bg-card text-foreground",
                disabled && "cursor-not-allowed opacity-50"
              )}
            >
              {size}
            </button>
          );
        })}
      </div>
    </div>
  );
}
