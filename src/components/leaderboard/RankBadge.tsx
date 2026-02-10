import { Badge } from "@/components/ui/badge";

interface RankBadgeProps {
  rank: number;
}

const BADGES: Record<number, { label: string; className: string }> = {
  1: {
    label: "1st",
    className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 shadow-[0_0_10px_rgba(234,179,8,0.2)]",
  },
  2: {
    label: "2nd",
    className: "bg-gray-300/20 text-gray-300 border-gray-300/30 shadow-[0_0_10px_rgba(209,213,219,0.15)]",
  },
  3: {
    label: "3rd",
    className: "bg-amber-600/20 text-amber-500 border-amber-600/30 shadow-[0_0_10px_rgba(217,119,6,0.15)]",
  },
};

export default function RankBadge({ rank }: RankBadgeProps) {
  const badge = BADGES[rank];

  if (!badge) {
    return (
      <span className="flex h-8 w-8 items-center justify-center text-sm font-bold text-muted-foreground">
        {rank}
      </span>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`h-8 w-8 justify-center rounded-full p-0 text-xs font-black ${badge.className}`}
    >
      {badge.label}
    </Badge>
  );
}
