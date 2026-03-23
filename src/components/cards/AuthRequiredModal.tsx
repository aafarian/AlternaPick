"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, UserPlus, LogIn } from "lucide-react";

interface AuthRequiredModalProps {
  open: boolean;
  onClose: () => void;
  pickCount: number;
  /** When set, shows a "Play as Guest" option for email-invite challenges */
  onGuestLockIn?: () => void;
  guestLoading?: boolean;
  /** Override the post-auth redirect (e.g. challenge detail page) */
  redirectTo?: string;
}

export default function AuthRequiredModal({
  open,
  onClose,
  pickCount,
  onGuestLockIn,
  guestLoading = false,
  redirectTo,
}: AuthRequiredModalProps) {
  const router = useRouter();

  const isChallenge = !!onGuestLockIn;
  const authRedirect = encodeURIComponent(redirectTo ?? "/picks");
  const description = isChallenge
    ? `Your ${pickCount} ${pickCount === 1 ? "pick is" : "picks are"} saved. Sign up to track results, or play as a guest.`
    : `Your ${pickCount} ${pickCount === 1 ? "pick is" : "picks are"} saved. Create an account to lock them in.`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-card border-border max-w-xs gap-0 p-6">
        <DialogHeader className="items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-lg">Lock in your picks</DialogTitle>
          <DialogDescription className="text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            onClick={() => router.push(`/auth/signup?redirectTo=${authRedirect}`)}
            className="w-full gap-2"
            size="sm"
          >
            <UserPlus className="h-4 w-4" />
            Sign Up
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/auth/login?redirectTo=${authRedirect}`)}
            className="w-full gap-2"
            size="sm"
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
          {isChallenge && (
            <Button
              variant="ghost"
              onClick={onGuestLockIn}
              disabled={guestLoading}
              className="w-full gap-2 text-muted-foreground"
              size="sm"
            >
              <Lock className="h-4 w-4" />
              {guestLoading ? "Locking..." : "Play as Guest"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
