interface RankBadgeProps {
  rank: number;
}

const BADGES: Record<number, { label: string; bg: string; text: string }> = {
  1: { label: "1st", bg: "bg-yellow-500/20", text: "text-yellow-400" },
  2: { label: "2nd", bg: "bg-gray-300/20", text: "text-gray-300" },
  3: { label: "3rd", bg: "bg-amber-600/20", text: "text-amber-500" },
};

export default function RankBadge({ rank }: RankBadgeProps) {
  const badge = BADGES[rank];

  if (!badge) {
    return (
      <span className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-muted">
        {rank}
      </span>
    );
  }

  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${badge.bg} ${badge.text}`}
    >
      {badge.label}
    </span>
  );
}
