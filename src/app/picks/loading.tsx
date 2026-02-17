import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function CardsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header: title + button */}
      <div className="flex items-center justify-between">
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-36" />
        <AnimatedSkeleton variant="row" count={1} className="h-10 w-28" />
      </div>

      {/* Stats summary: 3 small cards */}
      <div className="grid grid-cols-3 gap-4">
        <AnimatedSkeleton variant="card" count={3} className="h-20" />
      </div>

      {/* Tab bar */}
      <AnimatedSkeleton variant="row" count={1} className="h-10 w-48" />

      {/* Card list */}
      <AnimatedSkeleton variant="card" count={3} className="h-44" />
    </div>
  );
}
