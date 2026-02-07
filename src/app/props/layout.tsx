"use client";

import { CardBuilderProvider } from "@/lib/cards/card-builder-context";
import CardBuilderPanel from "@/components/cards/CardBuilderPanel";
import type { ReactNode } from "react";

export default function PropsLayout({ children }: { children: ReactNode }) {
  return (
    <CardBuilderProvider>
      <div className="pb-24">{children}</div>
      <CardBuilderPanel />
    </CardBuilderProvider>
  );
}
