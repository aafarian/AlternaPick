"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from "next/image";
import { CheckCircle2, AlertCircle } from "lucide-react";

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

  const initial = (displayName ?? username).charAt(0).toUpperCase();
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
            <p className="font-medium">{name || username}</p>
            <p className="text-sm text-muted-foreground">@{username}</p>
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
