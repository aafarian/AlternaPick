import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function ActivityLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Title */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-44" />
      {/* Subtitle */}
      <AnimatedSkeleton variant="text" count={1} className="h-4 w-56" />

      {/* Activity items */}
      <AnimatedSkeleton
        variant="card"
        count={4}
        className="h-20 rounded-xl border border-border"
      />
    </div>
  );
}
