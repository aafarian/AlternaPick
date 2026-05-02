"use client";

import { Target, Layers, Swords } from "lucide-react";
import SlideshowModal from "./SlideshowModal";
import type { SlideshowSlide } from "./SlideshowModal";

const slides: SlideshowSlide[] = [
  {
    icon: <Target className="size-12 text-neon-green" />,
    title: "Pick Your Props",
    description:
      "Browse real NBA player over/under lines. See the stats, study the matchups, and pick whether a player will go over or under their projected line.",
  },
  {
    icon: <Layers className="size-12 text-neon-green" />,
    title: "Lock In Your Card",
    description:
      "Build a 6-pick card from your best predictions. Once you lock it in, your picks are set. Watch the games and see how many you hit.",
  },
  {
    icon: <Swords className="size-12 text-neon-green" />,
    title: "Challenge Friends",
    description:
      "Go head-to-head with friends in pick challenges. Both players lock in cards, and the one with more correct picks wins. No money — just bragging rights.",
  },
];

interface OnboardingModalProps {
  open: boolean;
  onDismiss: () => void;
}

export default function OnboardingModal({
  open,
  onDismiss,
}: OnboardingModalProps) {
  return (
    <SlideshowModal
      open={open}
      onClose={onDismiss}
      title="Welcome to AlternaPick"
      slides={slides}
      themeColor="green"
      finalButtonText="Get Started"
    />
  );
}
