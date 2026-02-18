import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function ShareCardLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Branding */}
      <AnimatedSkeleton
        variant="row"
        count={1}
        className="mb-8 h-8 w-40"
        containerClassName="items-center"
      />

      {/* Card container */}
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        {/* Card header */}
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AnimatedSkeleton
                variant="avatar"
                count={1}
                className="h-8 w-8"
              />
              <AnimatedSkeleton
                variant="text"
                count={1}
                className="h-4 w-24"
              />
            </div>
            <AnimatedSkeleton variant="text" count={1} className="h-3 w-16" />
          </div>
          <div className="flex items-center justify-between">
            <AnimatedSkeleton variant="text" count={1} className="h-4 w-20" />
            <AnimatedSkeleton variant="text" count={1} className="h-8 w-12" />
          </div>
        </div>

        {/* Pick rows */}
        <AnimatedSkeleton
          variant="row"
          count={6}
          containerClassName="gap-1 p-2"
          className="h-14 rounded-lg"
        />

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 border-t border-border px-5 py-4">
          <AnimatedSkeleton
            variant="text"
            count={1}
            className="h-3 w-32"
            containerClassName="items-center"
          />
          <AnimatedSkeleton
            variant="row"
            count={1}
            className="h-9 w-28 rounded-lg"
            containerClassName="items-center"
          />
        </div>
      </div>
    </div>
  );
}
