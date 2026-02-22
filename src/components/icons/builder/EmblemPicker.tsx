"use client";

import type { EmblemId } from "@/lib/icons/types";
import { EMBLEMS } from "@/lib/icons/constants";
import { EMBLEM_COMPONENTS } from "@/components/icons/emblems";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ---------- Props ---------- */

interface EmblemPickerProps {
  selected: EmblemId;
  emblemColor: string;
  onSelect: (emblemId: EmblemId) => void;
}

/* ---------- Component ---------- */

export default function EmblemPicker({
  selected,
  emblemColor,
  onSelect,
}: EmblemPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Emblems"
      className="flex flex-wrap gap-1.5"
    >
      <TooltipProvider>
        {EMBLEMS.map((emblem) => {
          const EmblemComponent = EMBLEM_COMPONENTS[emblem.id];
          const isSelected = selected === emblem.id;

          return (
            <Tooltip key={emblem.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={emblem.label}
                  onClick={() => onSelect(emblem.id)}
                  className={cn(
                    "flex items-center justify-center rounded-md p-1 transition-all duration-150",
                    "min-h-[44px] min-w-[44px]",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background bg-accent"
                      : "bg-transparent"
                  )}
                >
                  <svg
                    viewBox="0 0 64 64"
                    width={36}
                    height={36}
                    aria-hidden="true"
                  >
                    <EmblemComponent color={emblemColor} />
                  </svg>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {emblem.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </TooltipProvider>
    </div>
  );
}
