"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

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
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="mb-4 text-lg font-semibold">Edit Profile</h3>

      {message && (
        <div
          className={`mb-4 rounded-md px-3 py-2 text-sm ${
            message.type === "success"
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="display_name"
            className="mb-1 block text-sm text-muted"
          >
            Display Name
          </label>
          <input
            id="display_name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="avatar_url"
            className="mb-1 block text-sm text-muted"
          >
            Avatar URL
          </label>
          <input
            id="avatar_url"
            type="url"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
