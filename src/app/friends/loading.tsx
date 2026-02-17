import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function FriendsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Page title */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-36" />

      {/* Search bar */}
      <AnimatedSkeleton variant="row" count={1} className="h-12 w-full rounded-xl" />

      {/* Section label */}
      <AnimatedSkeleton variant="row" count={1} className="h-6 w-48" />

      {/* Avatar rows — friend list */}
      <AnimatedSkeleton
        variant="avatar"
        count={4}
        containerClassName="gap-4"
        className="h-20 w-full rounded-xl"
      />

      {/* Card list */}
      <AnimatedSkeleton variant="card" count={3} />
    </div>
  );
}
