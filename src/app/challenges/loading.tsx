import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function ChallengesLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-44" />
        <AnimatedSkeleton variant="row" count={1} className="h-10 w-36" />
      </div>

      {/* Tab bar */}
      <AnimatedSkeleton
        variant="row"
        count={4}
        containerClassName="flex-row gap-2"
        className="h-9 w-24 rounded-lg"
      />

      {/* Card list */}
      <AnimatedSkeleton variant="card" count={3} className="h-20" />
    </div>
  );
}
