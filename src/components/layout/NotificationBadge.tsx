"use client";

/**
 * A small red notification badge that displays a count.
 * Renders nothing when count is 0.
 * Shows "9+" for counts greater than 9.
 */
export default function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  const display = count > 9 ? "9+" : String(count);

  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
      {display}
    </span>
  );
}
