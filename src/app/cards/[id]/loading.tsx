import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function CardDetailLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      {/* Card shell */}
      <div className="rounded-xl border border-border bg-card">
        {/* Card header: status badge, type badge, date */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <AnimatedSkeleton variant="row" count={1} className="h-5 w-16 rounded-full" />
            <AnimatedSkeleton variant="row" count={1} className="h-4 w-10 rounded-full" />
            <AnimatedSkeleton variant="row" count={1} className="h-3 w-24" />
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-border" />

        {/* Pick rows */}
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
          >
            {/* Player avatar */}
            <AnimatedSkeleton variant="avatar" count={1} className="h-10 w-10" />
            {/* Player name + stat line */}
            <div className="flex flex-1 flex-col gap-1.5">
              <AnimatedSkeleton variant="row" count={1} className="h-3.5 w-32" />
              <AnimatedSkeleton variant="row" count={1} className="h-3 w-24" />
            </div>
            {/* Over/under indicator */}
            <AnimatedSkeleton variant="row" count={1} className="h-5 w-12" />
          </div>
        ))}

        {/* Card footer: share button area */}
        <div className="flex justify-end px-4 py-3">
          <AnimatedSkeleton variant="row" count={1} className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  );
}
