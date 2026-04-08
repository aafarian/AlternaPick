"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { updateUsername, dismissUsernamePrompt } from "@/lib/auth/actions";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

interface UsernameSetupModalProps {
  open: boolean;
  onComplete: () => void;
}

export default function UsernameSetupModal({
  open,
  onComplete,
}: UsernameSetupModalProps) {
  const [username, setUsername] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const isValidFormat = USERNAME_RE.test(username);

  // Debounced availability check
  useEffect(() => {
    setAvailable(null);
    setError(null);

    if (!isValidFormat) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(username)}`
        );
        const data = await res.json();
        setAvailable(data.available);
        if (!data.available) {
          setError("Username already taken");
        }
      } catch {
        setError("Failed to check availability");
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [username, isValidFormat]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidFormat || !available) return;

    setSaving(true);
    setError(null);

    const result = await updateUsername(username);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    onComplete();
  }

  async function handleSkip() {
    // Persist the dismissal so the modal doesn't re-fire on every visit.
    // Failure is non-fatal — worst case, user sees the modal again next load.
    await dismissUsernamePrompt();
    onComplete();
  }

  const formatHint =
    username.length > 0 && !isValidFormat
      ? "3-20 characters, letters, numbers, and underscores only"
      : null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        className="bg-card border-border sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Choose a Username</DialogTitle>

        <div className="flex flex-col items-center text-center pt-4 pb-2 px-2">
          <h2 className="text-xl font-bold text-primary mb-2">
            Choose a Username
          </h2>
          <p className="text-muted-foreground text-sm mb-6 max-w-xs">
            Pick a username so friends can find and challenge you.
          </p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="relative">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="username"
                maxLength={20}
                autoFocus
                className="pr-10"
              />
              {/* Status indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                )}
                {!checking && available === true && (
                  <CheckCircle2 className="size-4 text-neon-green" />
                )}
                {!checking && available === false && (
                  <AlertCircle className="size-4 text-destructive" />
                )}
              </div>
            </div>

            {formatHint && (
              <p className="text-xs text-muted-foreground text-left">
                {formatHint}
              </p>
            )}
            {error && (
              <p className="text-xs text-destructive text-left">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="flex-1"
              >
                Skip
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!isValidFormat || !available || saving}
                className="flex-1 bg-neon-green text-black hover:bg-neon-green/90 font-semibold"
              >
                {saving ? "Setting..." : "Set Username"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
