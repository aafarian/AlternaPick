import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Title */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-28" />

      {/* Tab bar */}
      <AnimatedSkeleton
        variant="row"
        count={3}
        containerClassName="flex-row gap-1 rounded-lg bg-muted p-[3px]"
        className="h-8 w-28 rounded-md"
      />

      {/* Tab content card */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4">
          {/* Section title */}
          <AnimatedSkeleton variant="row" count={1} className="h-6 w-40" />
          {/* Section description */}
          <AnimatedSkeleton variant="text" count={1} className="h-4 w-72" />

          {/* Form fields */}
          <div className="mt-4 flex flex-col gap-3">
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-20" />
            <AnimatedSkeleton
              variant="row"
              count={1}
              className="h-10 w-full rounded-lg"
            />
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-24" />
            <AnimatedSkeleton
              variant="row"
              count={1}
              className="h-10 w-full rounded-lg"
            />
            <AnimatedSkeleton
              variant="row"
              count={1}
              className="h-10 w-28 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
