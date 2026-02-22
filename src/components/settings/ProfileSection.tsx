"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/icons/UserAvatar";
import IconBuilder from "@/components/icons/builder/IconBuilder";
import type { IconConfig } from "@/lib/icons/types";
import { CheckCircle2, AlertCircle, Pencil, X, Loader2 } from "lucide-react";
import { updateUsername } from "@/lib/auth/actions";
import { toast } from "sonner";

interface ProfileSectionProps {
  avatarUrl: string | null;
  iconConfig: IconConfig | null;
  userId: string;
  username: string;
}

export default function ProfileSection({
  avatarUrl,
  iconConfig,
  userId,
  username,
}: ProfileSectionProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [savedIconConfig, setSavedIconConfig] = useState<IconConfig | null>(null);

  // Username editing state
  const [currentUsername, setCurrentUsername] = useState(username);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState(username);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaving, setUsernameSaving] = useState(false);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const usernameValid = /^[a-zA-Z0-9_]{3,20}$/.test(newUsername);

  // Debounced username availability check
  useEffect(() => {
    if (!editingUsername) return;

    setUsernameAvailable(null);
    setUsernameError(null);

    // No check needed if same as current or invalid format
    if (newUsername === currentUsername || !usernameValid) return;

    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

    usernameDebounceRef.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await fetch(
          `/api/users/check-username?username=${encodeURIComponent(newUsername)}`
        );
        const data = await res.json();
        setUsernameAvailable(data.available);
        if (!data.available) setUsernameError("Username already taken");
      } catch {
        setUsernameError("Failed to check availability");
      } finally {
        setUsernameChecking(false);
      }
    }, 400);

    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [newUsername, editingUsername, currentUsername, usernameValid]);

  async function handleUsernameSave() {
    if (!usernameValid || newUsername === currentUsername) return;
    if (usernameAvailable !== true) return;

    setUsernameSaving(true);
    setUsernameError(null);

    const result = await updateUsername(newUsername);

    if (result.error) {
      setUsernameError(result.error);
      setUsernameSaving(false);
      return;
    }

    setCurrentUsername(newUsername);
    setEditingUsername(false);
    setUsernameSaving(false);
    toast.success("Username updated!");
  }

  function handleUsernameCancel() {
    setEditingUsername(false);
    setNewUsername(currentUsername);
    setUsernameAvailable(null);
    setUsernameError(null);
  }

  // The active icon config: saved config takes priority, then the prop from the server
  const activeIconConfig = savedIconConfig ?? iconConfig;
  // After saving an icon, avatarUrl is cleared server-side; reflect that locally too
  const activeAvatarUrl = savedIconConfig ? null : avatarUrl;

  async function handleIconSave(config: IconConfig) {
    setSaving(true);

    try {
      const res = await fetch("/api/profile/icon", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save icon");
      }

      setSavedIconConfig(config);
      toast.success("Icon saved!");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save icon");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Profile Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your icon and public profile information.
      </p>

      <div className="mt-6">
        <div className="mb-6 flex items-center gap-4">
          <UserAvatar
            avatarUrl={activeAvatarUrl}
            iconConfig={activeIconConfig}
            userId={userId}
            username={currentUsername}
            size={64}
          />
          <div>
            <p className="font-medium">{currentUsername}</p>
            {editingUsername ? (
              <div className="mt-1 flex items-center gap-2">
                <div className="relative">
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.trim())}
                    className="h-8 w-40 pr-8 text-sm"
                    maxLength={20}
                    autoFocus
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {usernameChecking && (
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                    )}
                    {!usernameChecking && usernameAvailable === true && (
                      <CheckCircle2 className="size-3.5 text-neon-green" />
                    )}
                    {!usernameChecking && usernameAvailable === false && (
                      <AlertCircle className="size-3.5 text-destructive" />
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={handleUsernameSave}
                  disabled={
                    !usernameValid ||
                    usernameAvailable !== true ||
                    usernameSaving ||
                    newUsername === currentUsername
                  }
                >
                  {usernameSaving ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={handleUsernameCancel}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-muted-foreground">@{currentUsername}</p>
                <button
                  onClick={() => setEditingUsername(true)}
                  className="text-muted-foreground hover:text-primary transition-colors"
                >
                  <Pencil className="size-3" />
                </button>
              </div>
            )}
            {usernameError && editingUsername && (
              <p className="mt-1 text-xs text-destructive">{usernameError}</p>
            )}
          </div>
        </div>

        <IconBuilder
          initialConfig={activeIconConfig}
          userId={userId}
          onSave={handleIconSave}
          saving={saving}
        />
      </div>
    </div>
  );
}
