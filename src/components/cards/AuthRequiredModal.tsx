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
import { Lock } from "lucide-react";

interface AuthRequiredModalProps {
  open: boolean;
  onClose: () => void;
  pickCount: number;
}

export default function AuthRequiredModal({
  open,
  onClose,
  pickCount,
}: AuthRequiredModalProps) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="bg-card border-border max-w-xs gap-0 p-6">
        <DialogHeader className="items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <DialogTitle className="text-lg">Lock in your picks</DialogTitle>
          <DialogDescription className="text-sm">
            Your {pickCount} {pickCount === 1 ? "pick is" : "picks are"} saved.
            Create an account to lock them in.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-5 flex gap-3">
          <Button
            onClick={() => router.push("/auth/signup?redirectTo=/picks")}
            className="flex-1"
            size="sm"
          >
            Sign Up
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/auth/login?redirectTo=/picks")}
            className="flex-1"
            size="sm"
          >
            Sign In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
