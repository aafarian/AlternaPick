import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function ChallengeDetailLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-44" />
        <AnimatedSkeleton
          variant="row"
          count={1}
          className="h-6 w-20 rounded-full"
        />
      </div>

      {/* Matchup card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          {/* Player 1 */}
          <div className="flex flex-col items-center gap-3">
            <AnimatedSkeleton
              variant="avatar"
              count={1}
              className="h-16 w-16"
            />
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-20" />
            <AnimatedSkeleton variant="text" count={1} className="h-3 w-16" />
          </div>

          {/* VS divider */}
          <AnimatedSkeleton variant="text" count={1} className="h-6 w-8" />

          {/* Player 2 */}
          <div className="flex flex-col items-center gap-3">
            <AnimatedSkeleton
              variant="avatar"
              count={1}
              className="h-16 w-16"
            />
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-20" />
            <AnimatedSkeleton variant="text" count={1} className="h-3 w-16" />
          </div>
        </div>
      </div>

      {/* Card detail rows */}
      <AnimatedSkeleton
        variant="row"
        count={6}
        className="h-14 rounded-xl border border-border"
      />
    </div>
  );
}
