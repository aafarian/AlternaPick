import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function LeaderboardLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header */}
      <div>
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-44" />
        <AnimatedSkeleton
          variant="text"
          count={1}
          className="mt-2 h-4 w-28"
        />
      </div>

      {/* Tabs */}
      <AnimatedSkeleton
        variant="row"
        count={2}
        containerClassName="flex-row gap-2"
        className="h-9 w-24 rounded-lg"
      />

      {/* Row list */}
      <AnimatedSkeleton variant="row" count={5} className="h-14 rounded-xl" />
    </div>
  );
}
