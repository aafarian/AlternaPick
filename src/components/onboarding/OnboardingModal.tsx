"use client";

import { useState } from "react";
import { Target, Layers, Swords, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface OnboardingSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const slides: OnboardingSlide[] = [
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
  const [currentSlide, setCurrentSlide] = useState(0);

  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];

  function handleNext() {
    if (isLastSlide) {
      onDismiss();
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }

  function handleBack() {
    if (!isFirstSlide) {
      setCurrentSlide((prev) => prev - 1);
    }
  }

  function handleSkip() {
    onDismiss();
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-md"
      >
        {/* Accessible title for screen readers */}
        <DialogTitle className="sr-only">Welcome to AlternaPick</DialogTitle>

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Skip
        </button>

        {/* Slide content */}
        <div className="flex flex-col items-center text-center pt-4 pb-2 px-2">
          <div className="mb-6 flex items-center justify-center rounded-full bg-neon-green/10 p-4">
            {slide.icon}
          </div>
          <h2 className="text-xl font-bold text-primary mb-3">
            {slide.title}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            {slide.description}
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? "w-6 bg-neon-green"
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={isFirstSlide}
            className={isFirstSlide ? "invisible" : ""}
          >
            <ChevronLeft className="size-4" />
            Back
          </Button>

          <Button
            onClick={handleNext}
            size="sm"
            className="bg-neon-green text-black hover:bg-neon-green/90 font-semibold"
          >
            {isLastSlide ? (
              "Get Started"
            ) : (
              <>
                Next
                <ChevronRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
