"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ProfileEditFormProps {
  displayName: string | null;
  avatarUrl: string | null;
}

export default function ProfileEditForm({
  displayName,
  avatarUrl,
}: ProfileEditFormProps) {
  const { supabase, user } = useAuth();
  const [name, setName] = useState(displayName ?? "");
  const [avatar, setAvatar] = useState(avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <h3 className="mb-4 text-lg font-semibold">Edit Profile</h3>

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

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar_url">Avatar URL</Label>
            <Input
              id="avatar_url"
              type="url"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} size="sm">
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
