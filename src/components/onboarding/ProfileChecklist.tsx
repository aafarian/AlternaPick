"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, X } from "lucide-react";

const DISMISSED_KEY = "profile-checklist-dismissed";

export interface ChecklistItem {
  label: string;
  completed: boolean;
  href: string;
}

interface ProfileChecklistProps {
  items: ChecklistItem[];
}

export default function ProfileChecklist({ items }: ProfileChecklistProps) {
  const [dismissed, setDismissed] = useState(true); // default hidden until we check

  useEffect(() => {
    const stored = localStorage.getItem(DISMISSED_KEY);
    setDismissed(stored === "true");
  }, []);

  const completedCount = items.filter((i) => i.completed).length;
  const allComplete = completedCount === items.length;

  if (dismissed || allComplete) {
    return null;
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  };

  return (
    <Card className="border-border bg-card relative">
      <CardContent className="flex flex-col gap-3 p-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Complete Your Profile</h3>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {completedCount}/{items.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={handleDismiss}
            aria-label="Dismiss checklist"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-neon-green transition-all duration-300"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>

        {/* Checklist items */}
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li key={item.label}>
              {item.completed ? (
                <span className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-neon-green" />
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="flex items-center gap-2 text-sm text-foreground hover:text-neon-green transition-colors"
                >
                  <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
