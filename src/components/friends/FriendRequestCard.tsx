"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedButton } from "@/components/ui/animated-button";
import { motion, useReducedMotion } from "@/lib/motion";

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  friend_profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
  };
}

interface FriendRequestCardProps {
  request: FriendRequest;
  onAccept: (id: string) => Promise<void>;
  onDecline: (id: string) => Promise<void>;
}

type ExitAction = "accept" | "decline" | null;

export default function FriendRequestCard({
  request,
  onAccept,
  onDecline,
}: FriendRequestCardProps) {
  const prefersReduced = useReducedMotion();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);
  const [exitAction, setExitAction] = useState<ExitAction>(null);

  const handleAccept = useCallback(async () => {
    setLoading("accept");
    try {
      if (prefersReduced) {
        await onAccept(request.id);
      } else {
        setExitAction("accept");
      }
    } catch {
      setLoading(null);
      setExitAction(null);
    }
  }, [onAccept, request.id, prefersReduced]);

  const handleDecline = useCallback(async () => {
    setLoading("decline");
    try {
      if (prefersReduced) {
        await onDecline(request.id);
      } else {
        setExitAction("decline");
      }
    } catch {
      setLoading(null);
      setExitAction(null);
    }
  }, [onDecline, request.id, prefersReduced]);

  const handleAnimationComplete = useCallback(async () => {
    if (!exitAction) return;
    try {
      if (exitAction === "accept") {
        await onAccept(request.id);
      } else {
        await onDecline(request.id);
      }
    } catch {
      setLoading(null);
      setExitAction(null);
    }
  }, [exitAction, onAccept, onDecline, request.id]);

  const profile = request.friend_profile;
  const initials = profile.username
    .slice(0, 2)
    .toUpperCase();

  /* ---- Exit animation variants ---- */
  const acceptExitAnimation = {
    backgroundColor: [
      "rgba(0, 0, 0, 0)",
      "rgba(34, 197, 94, 0.15)",
      "rgba(34, 197, 94, 0.15)",
      "rgba(34, 197, 94, 0)",
    ],
    scale: [1, 1.01, 0.95, 0.8],
    opacity: [1, 1, 1, 0],
    transition: { duration: 0.5, times: [0, 0.2, 0.5, 1], ease: "easeOut" as const },
  };

  const declineExitAnimation = {
    x: -120,
    opacity: 0,
    transition: { duration: 0.35, ease: "easeIn" as const },
  };

  /* ---- Reduced-motion fallback: no animations ---- */
  if (prefersReduced) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-12 w-12">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
            )}
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">
              {profile.username}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              @{profile.username}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <AnimatedButton
              onClick={handleAccept}
              disabled={loading !== null}
              size="sm"
            >
              {loading === "accept" ? "..." : "Accept"}
            </AnimatedButton>
            <AnimatedButton
              onClick={handleDecline}
              disabled={loading !== null}
              variant="outline"
              size="sm"
            >
              {loading === "decline" ? "..." : "Decline"}
            </AnimatedButton>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ---- Full animated version ---- */
  return (
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={
        exitAction === "accept"
          ? acceptExitAnimation
          : exitAction === "decline"
            ? declineExitAnimation
            : { y: 0, opacity: 1 }
      }
      transition={{ duration: 0.35, ease: "easeOut" }}
      onAnimationComplete={() => {
        if (exitAction) {
          handleAnimationComplete();
        }
      }}
      style={{ borderRadius: "var(--radius)" }}
    >
      <Card className="border-border bg-card">
        <CardContent className="flex items-center gap-4 p-4">
          <Avatar className="h-12 w-12">
            {profile.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt={profile.username} />
            )}
            <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">
              {profile.username}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              @{profile.username}
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
            <AnimatedButton
              onClick={handleAccept}
              disabled={loading !== null}
              size="sm"
            >
              {loading === "accept" ? "..." : "Accept"}
            </AnimatedButton>
            <AnimatedButton
              onClick={handleDecline}
              disabled={loading !== null}
              variant="outline"
              size="sm"
            >
              {loading === "decline" ? "..." : "Decline"}
            </AnimatedButton>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
