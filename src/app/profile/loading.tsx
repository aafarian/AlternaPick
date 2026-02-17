import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-28" />

      {/* Profile card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <AnimatedSkeleton variant="avatar" count={1} className="h-16 w-16" />
          {/* Name + handle */}
          <div className="flex flex-col gap-2">
            <AnimatedSkeleton variant="text" count={1} className="h-5 w-32" />
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-24" />
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <AnimatedSkeleton variant="text" count={1} className="h-6 w-full" />
          <AnimatedSkeleton variant="text" count={1} className="h-6 w-full" />
          <AnimatedSkeleton variant="text" count={1} className="h-6 w-full" />
          <AnimatedSkeleton variant="text" count={1} className="h-6 w-full" />
        </div>
      </div>

      {/* Edit form card */}
      <AnimatedSkeleton variant="card" count={3} className="h-20" />
    </div>
  );
}
