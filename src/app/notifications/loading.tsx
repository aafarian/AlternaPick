import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

export default function NotificationsLoading() {
  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Title */}
      <AnimatedSkeleton variant="row" count={1} className="h-8 w-52" />
      {/* Subtitle */}
      <AnimatedSkeleton variant="text" count={1} className="h-4 w-64" />

      {/* Notification rows */}
      <AnimatedSkeleton
        variant="card"
        count={4}
        className="h-20 rounded-xl border border-border"
      />
    </div>
  );
}
