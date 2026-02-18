import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function HistoryLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-48" />

      {/* History cards */}
      <AnimatedSkeleton
        variant="card"
        count={3}
        className="h-64 rounded-xl border border-border"
      />
    </div>
  );
}
