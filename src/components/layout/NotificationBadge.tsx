"use client";

import { Badge } from "@/components/ui/badge";

export default function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;

  const display = count > 9 ? "9+" : String(count);

  return (
    <Badge
      variant="destructive"
      className="absolute -right-1.5 -top-1.5 h-4 min-w-4 px-1 text-[10px] font-bold leading-none"
    >
      {display}
    </Badge>
  );
}
