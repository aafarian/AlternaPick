import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function CardsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <AnimatedSkeleton variant="row" count={1} className="h-8 w-36" />
        <AnimatedSkeleton variant="row" count={1} className="h-10 w-28" />
      </div>

      {/* Sub-header */}
      <AnimatedSkeleton variant="row" count={1} className="h-6 w-32" />

      {/* Card grid */}
      <AnimatedSkeleton variant="card" count={4} className="h-56" />
    </div>
  );
}
