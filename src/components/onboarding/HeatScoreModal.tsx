"use client";

import { Flame, Target, ArrowUpDown, Trophy } from "lucide-react";
import SlideshowModal from "./SlideshowModal";
import type { SlideshowSlide } from "./SlideshowModal";

const slides: SlideshowSlide[] = [
  {
    icon: <Flame className="size-12 text-orange-400" />,
    title: "What is HeatScore?",
    description:
      "HeatScore measures how well you picked — not just how many you hit. Every correct pick earns points, and harder picks earn more. It shows up on every resolved card.",
    example: (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-orange-500/10 px-4 py-2.5">
        <Flame className="size-5 text-orange-400" />
        <span className="text-lg font-black tabular-nums text-orange-400">390</span>
        <span className="text-xs text-muted-foreground">HeatScore</span>
      </div>
    ),
  },
  {
    icon: <Target className="size-12 text-orange-400" />,
    title: "How It's Scored",
    description:
      "Each hit earns +130 base points, multiplied by the notch tier you chose. Picks at Standard (1x) earn 130. Volcanic picks (4x) earn 520. Misses earn zero base — but quality bonuses still apply.",
    example: (
      <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Standard hit</span>
          <span className="font-bold text-orange-400">+130</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Heated hit (1.75x)</span>
          <span className="font-bold text-orange-400">+228</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Volcanic hit (4x)</span>
          <span className="font-bold text-orange-400">+520</span>
        </div>
      </div>
    ),
  },
  {
    icon: <ArrowUpDown className="size-12 text-orange-400" />,
    title: "Quality Bonus",
    description:
      "Crush a line by a wide margin? You earn bonus points on top. The further the actual value is from the line, the bigger the quality bonus. This rewards confident, decisive picks — not just lucky ones.",
    example: (
      <div className="mt-3 flex flex-col gap-1.5 rounded-lg border border-border bg-card px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Line: 24.5 pts, Actual: 38</span>
          <span className="font-bold text-emerald-500">+25 bonus</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Line: 24.5 pts, Actual: 26</span>
          <span className="font-bold text-emerald-500">+3 bonus</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Line: 24.5 pts, Actual: 22</span>
          <span className="font-bold text-red-400">-5 penalty</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Trophy className="size-12 text-orange-400" />,
    title: "Tiebreaker in Challenges",
    description:
      "When you and a friend both hit the same number of picks, HeatScore breaks the tie. The player with the higher HeatScore wins — so shifting lines and crushing margins actually matters.",
    example: (
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">You</span>
          <span className="text-base font-black text-emerald-500">4/6</span>
          <span className="font-bold tabular-nums text-orange-400">HS 520</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <span className="text-[10px]">vs</span>
          <span className="text-lg font-black">tie</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground">Friend</span>
          <span className="text-base font-black text-red-400">4/6</span>
          <span className="font-bold tabular-nums text-orange-400">HS 390</span>
        </div>
      </div>
    ),
  },
];

interface HeatScoreModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HeatScoreModal({ open, onClose }: HeatScoreModalProps) {
  return (
    <SlideshowModal
      open={open}
      onClose={onClose}
      title="What is HeatScore?"
      slides={slides}
      themeColor="orange"
    />
  );
}
