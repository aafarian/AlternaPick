import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function LiveLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div>
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-40" />
        <AnimatedSkeleton
          variant="text"
          count={1}
          className="mt-1 h-4 w-64"
        />
      </div>

      {/* Game cards */}
      <AnimatedSkeleton
        variant="card"
        count={2}
        className="h-44 rounded-xl border border-border"
      />
    </div>
  );
}
