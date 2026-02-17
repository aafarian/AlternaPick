import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title skeleton */}
      <div>
        <AnimatedSkeleton count={1} variant="row" className="h-8 w-36" />
        <AnimatedSkeleton
          count={1}
          variant="row"
          className="mt-2 h-4 w-56"
        />
      </div>

      {/* Filter skeletons */}
      <AnimatedSkeleton count={1} variant="row" className="h-10 w-full rounded-lg" />
      <AnimatedSkeleton count={1} variant="row" className="h-9 w-64 rounded-lg" />

      {/* Overview cards skeleton */}
      <AnimatedSkeleton
        count={4}
        variant="card"
        className="h-20 rounded-xl"
        containerClassName="grid grid-cols-2 gap-3 sm:grid-cols-4"
      />

      {/* Summary card skeleton */}
      <AnimatedSkeleton count={1} variant="card" className="h-24 rounded-xl" />

      {/* Chart grid skeletons */}
      <AnimatedSkeleton
        count={4}
        variant="card"
        className="h-64 rounded-xl"
        containerClassName="grid gap-6 lg:grid-cols-2"
      />
    </div>
  );
}
