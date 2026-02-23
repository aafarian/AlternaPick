import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Heading */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-48" />
      {/* Description */}
      <AnimatedSkeleton variant="text" count={1} className="h-4 w-72" />

      {/* Content grid: stat-style cards */}
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <AnimatedSkeleton
            key={i}
            variant="card"
            count={1}
            className="h-28 rounded-xl border border-border"
          />
        ))}
      </div>
    </div>
  );
}
