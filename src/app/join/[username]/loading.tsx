import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function JoinLoading() {
  return (
    <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <AnimatedSkeleton
            variant="row"
            count={1}
            className="h-10 w-48"
            containerClassName="items-center"
          />
          <AnimatedSkeleton
            variant="text"
            count={1}
            className="h-4 w-40"
            containerClassName="items-center"
          />
        </div>

        {/* Referrer card */}
        <div className="w-full rounded-2xl border border-border bg-card/80 p-6 shadow-lg shadow-primary/5 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-5">
            {/* Avatar */}
            <AnimatedSkeleton
              variant="avatar"
              count={1}
              className="h-24 w-24"
              containerClassName="items-center"
            />

            {/* Invite heading */}
            <div className="flex flex-col items-center gap-1.5">
              <AnimatedSkeleton
                variant="text"
                count={1}
                className="h-3.5 w-36"
                containerClassName="items-center"
              />
              <AnimatedSkeleton
                variant="row"
                count={1}
                className="h-7 w-32"
                containerClassName="items-center"
              />
              <AnimatedSkeleton
                variant="text"
                count={1}
                className="h-3.5 w-20"
                containerClassName="items-center"
              />
            </div>

            {/* Stats badges */}
            <div className="grid w-full grid-cols-3 gap-2">
              {Array.from({ length: 3 }, (_, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background/50 px-3 py-3"
                >
                  <AnimatedSkeleton
                    variant="avatar"
                    count={1}
                    className="h-4 w-4"
                    containerClassName="items-center"
                  />
                  <AnimatedSkeleton
                    variant="row"
                    count={1}
                    className="h-5 w-8"
                    containerClassName="items-center"
                  />
                  <AnimatedSkeleton
                    variant="text"
                    count={1}
                    className="h-2.5 w-14"
                    containerClassName="items-center"
                  />
                </div>
              ))}
            </div>

            {/* Social proof */}
            <AnimatedSkeleton
              variant="text"
              count={1}
              className="h-4 w-56"
              containerClassName="items-center"
            />

            {/* CTA button */}
            <AnimatedSkeleton
              variant="row"
              count={1}
              className="mt-1 h-11 w-full rounded-lg"
            />

            {/* Sign in link */}
            <AnimatedSkeleton
              variant="text"
              count={1}
              className="h-3 w-40"
              containerClassName="items-center"
            />
          </div>
        </div>

        {/* Value proposition pills */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <AnimatedSkeleton
              key={i}
              variant="row"
              count={1}
              className="h-7 w-28 rounded-full"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
