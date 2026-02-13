"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";
import { CheckCircle2, AlertCircle, Pencil, X, Loader2 } from "lucide-react";
import { updateUsername } from "@/lib/auth/actions";

interface ProfileSectionProps {
  displayName: string | null;
  avatarUrl: string | null;
  username: string;
}

export default function ProfileSection({
  displayName,
  avatarUrl,
  username,
}: ProfileSectionProps) {
  const { supabase, user } = useAuth();
  const [name, setName] = useState(displayName ?? "");
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    setMessage({ type: "success", text: "Username updated!" });
  }

  function handleUsernameCancel() {
    setEditingUsername(false);
    setNewUsername(currentUsername);
    setUsernameAvailable(null);
    setUsernameError(null);
  }

  const initial = (displayName ?? currentUsername).charAt(0).toUpperCase();
  const previewUrl = avatar || avatarUrl;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setMessage(null);

    const { error } = await (supabase.from("profiles") as any)
      .update({
        display_name: name || null,
        avatar_url: avatar || null,
      })
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Profile updated!" });
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold">Profile Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage your display name, avatar, and public profile information.
      </p>

      <div className="mt-6">
        {message && (
          <Alert
            variant={message.type === "error" ? "destructive" : "default"}
            className={
              message.type === "success"
                ? "mb-4 border-neon-green/30 bg-neon-green/10 text-neon-green"
                : "mb-4"
            }
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <div className="mb-6 flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {previewUrl && (
              <Image
                src={previewUrl}
                alt={name || username}
                width={64}
                height={64}
                className="aspect-square size-full object-cover"
              />
            )}
            <AvatarFallback className="bg-primary/10 text-2xl font-bold text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{name || currentUsername}</p>
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

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="settings_display_name">Display Name</Label>
            <Input
              id="settings_display_name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings_avatar_url">Avatar URL</Label>
            <Input
              id="settings_avatar_url"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} size="sm">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
