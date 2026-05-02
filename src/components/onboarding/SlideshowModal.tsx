"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface SlideshowSlide {
  icon: React.ReactNode;
  title: string;
  description: string;
  example?: React.ReactNode;
}

type ThemeColor = "green" | "orange";

const themeStyles: Record<
  ThemeColor,
  {
    iconBg: string;
    titleColor: string;
    dotColor: string;
    nextButton: string;
  }
> = {
  green: {
    iconBg: "bg-neon-green/10",
    titleColor: "text-primary",
    dotColor: "bg-neon-green",
    nextButton: "bg-neon-green text-black hover:bg-neon-green/90 font-semibold",
  },
  orange: {
    iconBg: "bg-orange-500/10",
    titleColor: "text-orange-400",
    dotColor: "bg-orange-400",
    nextButton:
      "bg-orange-500 text-white hover:bg-orange-500/90 font-semibold",
  },
};

interface SlideshowModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  slides: SlideshowSlide[];
  themeColor: ThemeColor;
  finalButtonText?: string;
}

export default function SlideshowModal({
  open,
  onClose,
  title,
  slides,
  themeColor,
  finalButtonText = "Got It",
}: SlideshowModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === slides.length - 1;
  const slide = slides[currentSlide];
  const theme = themeStyles[themeColor];

  function handleNext() {
    if (isLastSlide) {
      onClose();
      setCurrentSlide(0);
    } else {
      setCurrentSlide((prev) => prev + 1);
    }
  }

  function handleBack() {
    if (!isFirstSlide) {
      setCurrentSlide((prev) => prev - 1);
    }
  }

  function handleClose() {
    onClose();
    setCurrentSlide(0);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-md"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Skip button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          Skip
        </button>

        {/* Slide content */}
        <div className="flex flex-col items-center text-center pt-4 pb-2 px-2">
          <div
            className={`mb-6 flex items-center justify-center rounded-full ${theme.iconBg} p-4`}
          >
            {slide.icon}
          </div>
          <h2 className={`text-xl font-bold ${theme.titleColor} mb-3`}>
            {slide.title}
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
            {slide.description}
          </p>
          {slide.example}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 py-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all ${
                index === currentSlide
                  ? `w-6 ${theme.dotColor}`
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
            className={theme.nextButton}
          >
            {isLastSlide ? (
              finalButtonText
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
