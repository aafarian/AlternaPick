import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function UserProfileLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 py-8">
      {/* Profile card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <AnimatedSkeleton variant="avatar" count={1} className="h-16 w-16" />
          {/* Name, @username, member since */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <AnimatedSkeleton variant="text" count={1} className="h-6 w-36" />
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-28" />
            <AnimatedSkeleton variant="text" count={1} className="h-3 w-40" />
          </div>
          {/* Action button placeholder */}
          <AnimatedSkeleton variant="row" count={1} className="h-8 w-24 shrink-0 rounded-md" />
        </div>

        {/* Stats grid: 2 cols mobile, 5 cols desktop */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <AnimatedSkeleton
              key={i}
              variant="card"
              count={1}
              className="h-[68px] rounded-xl"
            />
          ))}
        </div>
      </div>

      {/* Badges section */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <AnimatedSkeleton variant="text" count={1} className="h-6 w-32" />
          <AnimatedSkeleton variant="text" count={1} className="h-4 w-36" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <AnimatedSkeleton
              key={i}
              variant="card"
              count={1}
              className="h-24 rounded-xl"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
