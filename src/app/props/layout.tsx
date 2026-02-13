"use client";

import { Suspense } from "react";
import { CardBuilderProvider } from "@/lib/cards/card-builder-context";
import CardBuilderPanel from "@/components/cards/CardBuilderPanel";
import ChallengeInitializer from "@/components/cards/ChallengeInitializer";
import type { ReactNode } from "react";

export default function PropsLayout({ children }: { children: ReactNode }) {
  return (
    <CardBuilderProvider>
      <Suspense fallback={null}>
        <ChallengeInitializer />
      </Suspense>
      <div className="pb-36 md:pb-24">{children}</div>
      <CardBuilderPanel />
    </CardBuilderProvider>
  );
}
