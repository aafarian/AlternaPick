import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function CardShareLoading() {
  return (
    <div className="mx-auto max-w-lg py-8">
      {/* Card container */}
      <div className="rounded-xl border border-border bg-card">
        {/* Card header: username + badge */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-28" />
            <AnimatedSkeleton variant="text" count={1} className="h-5 w-20 rounded-full" />
          </div>
        </div>

        {/* Pick rows */}
        <div className="flex flex-col gap-1 p-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg bg-background/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <AnimatedSkeleton variant="avatar" count={1} className="h-4 w-4" />
                <AnimatedSkeleton variant="text" count={1} className="h-4 w-24" />
                <AnimatedSkeleton variant="text" count={1} className="h-4 w-12 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <AnimatedSkeleton variant="text" count={1} className="h-4 w-8" />
                <AnimatedSkeleton variant="text" count={1} className="h-5 w-14 rounded-full" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer: CTA button */}
        <div className="flex justify-center px-4 py-4">
          <AnimatedSkeleton
            variant="row"
            count={1}
            className="h-9 w-40 rounded-lg"
            containerClassName="items-center"
          />
        </div>
      </div>
    </div>
  );
}
