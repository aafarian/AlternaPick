"use client";

import { useMemo } from "react";
import type { EmblemId, EmblemCategory } from "@/lib/icons/types";
import { EMBLEMS } from "@/lib/icons/constants";
import { EMBLEM_COMPONENTS } from "@/components/icons/emblems";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ---------- Category Display Labels ---------- */

const CATEGORY_LABELS: Record<EmblemCategory, string> = {
  animals: "Animals",
  sports: "Sports",
  symbols: "Symbols",
};

/** Ordering guarantee for categories */
const CATEGORY_ORDER: EmblemCategory[] = ["animals", "sports", "symbols"];

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
  /** Group emblems by category, preserving insertion order within each group */
  const grouped = useMemo(() => {
    const map = new Map<EmblemCategory, typeof EMBLEMS[number][]>();
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, []);
    }
    for (const emblem of EMBLEMS) {
      map.get(emblem.category)!.push(emblem);
    }
    return map;
  }, []);

  return (
    <div className="space-y-3">
      {CATEGORY_ORDER.map((category) => {
        const emblems = grouped.get(category)!;
        return (
          <div key={category}>
            {/* Category heading */}
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </h4>

            {/* Emblem grid */}
            <div
              role="radiogroup"
              aria-label={`${CATEGORY_LABELS[category]} emblems`}
              className="flex flex-wrap gap-1.5"
            >
              <TooltipProvider>
                {emblems.map((emblem) => {
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
                            "flex items-center justify-center rounded-md p-1 transition-colors",
                            "min-h-[44px] min-w-[44px]",
                            "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected
                              ? "ring-2 ring-primary bg-accent"
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
          </div>
        );
      })}
    </div>
  );
}
