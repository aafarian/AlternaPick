import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function PropsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <AnimatedSkeleton variant="row" count={1} className="h-9 w-56" />
        <AnimatedSkeleton variant="row" count={1} className="h-4 w-40" />
      </div>

      {/* Sport selector pills */}
      <AnimatedSkeleton
        variant="row"
        count={6}
        containerClassName="flex-row gap-2"
        className="h-8 w-20 rounded-full"
      />

      {/* Game cards */}
      <AnimatedSkeleton variant="card" count={3} className="h-48 rounded-xl" />
    </div>
  );
}
