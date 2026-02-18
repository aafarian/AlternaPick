import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function CardsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header: title + button */}
      <div className="flex items-center justify-between">
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-36" />
        <AnimatedSkeleton variant="row" count={1} className="h-9 w-28" />
      </div>

      {/* Stats: 2 cols mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <AnimatedSkeleton key={i} variant="card" count={1} className="h-[88px]" />
        ))}
      </div>

      {/* Tab bar */}
      <AnimatedSkeleton variant="row" count={1} className="h-10 w-48" />

      {/* Card grid: 1 col mobile, 2 cols desktop */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-border bg-card">
            {/* Card header skeleton */}
            <div className="flex items-center justify-between px-4 py-3">
              <AnimatedSkeleton variant="row" count={1} className="h-5 w-20" />
              <div className="flex gap-1">
                {Array.from({ length: 3 }, (_, j) => (
                  <AnimatedSkeleton key={j} variant="avatar" count={1} className="h-2 w-2" />
                ))}
              </div>
            </div>
            {/* Pick row skeletons */}
            {Array.from({ length: 3 }, (_, j) => (
              <div key={j} className="flex items-center gap-3 border-t border-border/30 px-4 py-3">
                <AnimatedSkeleton variant="avatar" count={1} className="h-10 w-10" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <AnimatedSkeleton variant="row" count={1} className="h-3.5 w-32" />
                  <AnimatedSkeleton variant="row" count={1} className="h-3 w-24" />
                </div>
                <AnimatedSkeleton variant="row" count={1} className="h-5 w-8" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
