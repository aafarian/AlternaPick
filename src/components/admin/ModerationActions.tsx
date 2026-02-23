"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, ShieldOff, ShieldCheck, KeyRound } from "lucide-react";
import type { AdminModerationActionType } from "@/lib/admin/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModerationActionsProps {
  userId: string;
  username: string;
  email: string | null;
  isDeactivated: boolean;
  onActionComplete?: () => void;
}

// ---------------------------------------------------------------------------
// Action configuration
// ---------------------------------------------------------------------------

interface ActionConfig {
  action: AdminModerationActionType;
  label: string;
  icon: React.ElementType;
  variant: "destructive" | "default" | "outline";
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: "destructive" | "default";
}

function getActions(
  username: string,
  email: string | null,
  isDeactivated: boolean
): ActionConfig[] {
  const actions: ActionConfig[] = [];

  if (isDeactivated) {
    actions.push({
      action: "reactivate",
      label: "Reactivate",
      icon: ShieldCheck,
      variant: "default",
      title: `Reactivate ${username}?`,
      description: `This will restore "${username}"'s account and allow them to log in and use the platform again.`,
      confirmLabel: "Reactivate Account",
      confirmVariant: "default",
    });
  } else {
    actions.push({
      action: "deactivate",
      label: "Deactivate",
      icon: ShieldOff,
      variant: "destructive",
      title: `Deactivate ${username}?`,
      description: `This will deactivate "${username}"'s account. They will no longer be able to log in or use the platform until reactivated.`,
      confirmLabel: "Deactivate Account",
      confirmVariant: "destructive",
    });
  }

  actions.push({
    action: "reset_password",
    label: "Reset Password",
    icon: KeyRound,
    variant: "outline",
    title: `Reset password for ${username}?`,
    description: email
      ? `A password reset email will be sent to ${email}. The user will need to follow the link in the email to set a new password.`
      : `This user does not have an email address on file. The password reset cannot be sent.`,
    confirmLabel: "Send Reset Email",
    confirmVariant: "default",
  });

  return actions;
}

// ---------------------------------------------------------------------------
// Single action button with confirmation dialog
// ---------------------------------------------------------------------------

function ModerationActionButton({
  config,
  userId,
  email,
  onActionComplete,
}: {
  config: ActionConfig;
  userId: string;
  email: string | null;
  onActionComplete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const Icon = config.icon;
  const isResetDisabled =
    config.action === "reset_password" && !email;

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: config.action, targetId: userId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data?.error ?? data?.message ?? `Failed to execute action (${res.status})`
        );
      }

      toast.success(data.message ?? "Action completed successfully");
      setOpen(false);
      onActionComplete?.();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }, [config.action, userId, onActionComplete]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={config.variant} size="sm" className="gap-1.5">
          <Icon className="h-4 w-4" />
          {config.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{config.title}</AlertDialogTitle>
          <AlertDialogDescription>{config.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={loading || isResetDisabled}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {config.confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ModerationActions({
  userId,
  username,
  email,
  isDeactivated,
  onActionComplete,
}: ModerationActionsProps) {
  const actions = getActions(username, email, isDeactivated);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((config) => (
        <ModerationActionButton
          key={config.action}
          config={config}
          userId={userId}
          email={email}
          onActionComplete={onActionComplete}
        />
      ))}
    </div>
  );
}
