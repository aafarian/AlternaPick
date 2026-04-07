"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ChallengeMatchup from "@/components/challenges/ChallengeMatchup";
import GroupLobbyView from "@/components/challenges/GroupLobbyView";
import type { ChallengeDetail } from "@/lib/challenges/queries";

/**
 * Client wrapper for the intercepted challenge modal. Closing the dialog
 * calls router.back() so the URL returns to /challenges and the modal
 * slot resets to its default (null), which dismisses the overlay.
 */
export function ChallengeModal({
  challenge,
  currentUserId,
}: {
  challenge: ChallengeDetail;
  currentUserId: string;
}) {
  const router = useRouter();

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) router.back();
    },
    [router],
  );

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Challenge detail</DialogTitle>
        </DialogHeader>
        {challenge.lobby_type === "group" ? (
          <GroupLobbyView challenge={challenge} currentUserId={currentUserId} />
        ) : (
          <ChallengeMatchup challenge={challenge} currentUserId={currentUserId} />
        )}
      </DialogContent>
    </Dialog>
  );
}
