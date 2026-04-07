"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CardDetail from "@/components/cards/CardDetail";
import type { CardWithPicks } from "@/lib/cards/api";

/**
 * Client wrapper for the intercepted card modal. Closing the dialog calls
 * router.back() so the URL returns to /picks and the modal slot resets to
 * its default (null), which dismisses the overlay.
 */
export function CardModal({ card }: { card: CardWithPicks }) {
  const router = useRouter();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) router.back();
    },
    [router],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Card detail</DialogTitle>
        </DialogHeader>
        <CardDetail card={card} linked={false} />
      </DialogContent>
    </Dialog>
  );
}
