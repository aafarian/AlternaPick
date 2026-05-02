"use client";

import { Gift, Swords, TrendingUp } from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import SlideshowModal from "./SlideshowModal";
import type { SlideshowSlide } from "./SlideshowModal";

const slides: SlideshowSlide[] = [
  {
    icon: <FlameTokenIcon className="size-12 text-orange-400" />,
    title: "Flame Tokens",
    description:
      "Flame Tokens are your in-app currency. You start with 1,000 and earn more by playing. Use them to wager on your cards for bigger payouts.",
    example: (
      <div className="mt-3 flex items-center justify-center gap-3 rounded-lg bg-orange-500/10 px-4 py-2.5">
        <FlameTokenIcon className="size-5 text-orange-400" />
        <span className="text-lg font-black tabular-nums text-orange-400">1,000</span>
        <span className="text-xs text-muted-foreground">Starting balance</span>
      </div>
    ),
  },
  {
    icon: <Gift className="size-12 text-orange-400" />,
    title: "Daily Claim",
    description:
      "Come back every day to claim 50 free Flame Tokens. The badge in the header will glow when your daily claim is ready — just hover and tap to collect.",
    example: (
      <div className="mt-3 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 rounded-md bg-orange-500/15 px-3 py-1.5 text-sm font-bold text-orange-400">
          <Gift className="size-4" />
          Claim Daily +50
        </div>
        <span className="text-[10px] text-muted-foreground">Available once per day</span>
      </div>
    ),
  },
  {
    icon: <TrendingUp className="size-12 text-orange-400" />,
    title: "Wager Flame",
    description:
      "Toggle Wager Flame when building a card to put tokens on the line. Hit all your picks for up to 25x your wager. Miss too many and you bust — but the upside is huge.",
    example: (
      <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-card border border-border px-4 py-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">6/6 picks</span>
          <span className="font-bold text-emerald-500">25x payout</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">5/6 picks</span>
          <span className="font-bold text-emerald-500">5x payout</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">3/6 or fewer</span>
          <span className="font-bold text-red-400">Bust</span>
        </div>
      </div>
    ),
  },
  {
    icon: <Swords className="size-12 text-orange-400" />,
    title: "Challenge Bonuses",
    description:
      "Win a challenge to earn 25 bonus Flame Tokens. Tie? You still get 10. Challenges are free to enter — no wager required.",
    example: (
      <div className="mt-3 flex items-center justify-center gap-6 text-xs">
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-black text-emerald-500">+25</span>
          <span className="text-muted-foreground">Win</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-black text-orange-400">+10</span>
          <span className="text-muted-foreground">Tie</span>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-black text-muted-foreground">+0</span>
          <span className="text-muted-foreground">Loss</span>
        </div>
      </div>
    ),
  },
];

interface FlameTokensModalProps {
  open: boolean;
  onClose: () => void;
}

export default function FlameTokensModal({ open, onClose }: FlameTokensModalProps) {
  return (
    <SlideshowModal
      open={open}
      onClose={onClose}
      title="What are Flame Tokens?"
      slides={slides}
      themeColor="orange"
    />
  );
}
