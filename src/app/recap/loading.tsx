import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function RecapLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title skeleton */}
      <div>
        <AnimatedSkeleton count={1} variant="row" className="h-8 w-48" />
        <AnimatedSkeleton
          count={1}
          variant="row"
          className="mt-2 h-4 w-72"
        />
      </div>

      {/* Your Day section skeleton */}
      <AnimatedSkeleton count={1} variant="card" className="h-24 rounded-xl" />

      {/* Trap Props / Lock Props skeletons */}
      <AnimatedSkeleton
        count={2}
        variant="card"
        className="h-24 rounded-xl"
        containerClassName="grid gap-6 lg:grid-cols-2"
      />

      {/* Player Spotlights skeleton */}
      <AnimatedSkeleton count={1} variant="card" className="h-24 rounded-xl" />

      {/* Perfect Cards + Most Picked skeletons */}
      <AnimatedSkeleton
        count={2}
        variant="card"
        className="h-24 rounded-xl"
        containerClassName="grid gap-6 lg:grid-cols-2"
      />

      {/* Breakdowns skeleton */}
      <AnimatedSkeleton count={1} variant="card" className="h-32 rounded-xl" />
    </div>
  );
}
