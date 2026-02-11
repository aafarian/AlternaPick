"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Trash2,
  Link as LinkIcon,
} from "lucide-react";

interface AccountSectionProps {
  email: string;
  hasGoogleProvider: boolean;
  hasPasswordProvider: boolean;
}

export default function AccountSection({
  email,
  hasGoogleProvider,
  hasPasswordProvider,
}: AccountSectionProps) {
  return (
    <div className="space-y-6">
      {/* Change Password */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Change Password</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Update your account password. You must provide your current password
          for verification if you have one set.
        </p>
        {hasPasswordProvider ? (
          <ChangePasswordForm email={email} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Your account uses Google sign-in only. To set a password, use the{" "}
            <a
              href="/auth/reset-password"
              className="text-primary hover:underline"
            >
              password reset flow
            </a>
            .
          </p>
        )}
      </div>

      {/* Connected Accounts */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Manage your sign-in methods and connected services.
        </p>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium">Google</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasGoogleProvider
                  ? "bg-neon-green/10 text-neon-green"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {hasGoogleProvider ? "Connected" : "Not connected"}
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Email &amp; Password</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                hasPasswordProvider
                  ? "bg-neon-green/10 text-neon-green"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {hasPasswordProvider ? "Active" : "Not set"}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">
            Danger Zone
          </h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Permanently deactivate your account. Your data will be retained for 30
          days before deletion. This action can be undone by contacting support
          within that period.
        </p>
        <DeleteAccountButton />
      </div>
    </div>
  );
}

function ChangePasswordForm({ email }: { email: string }) {
  const { supabase } = useAuth();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const currentPassword = formData.get("current_password") as string;
    const newPassword = formData.get("new_password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (!currentPassword) {
      setMessage({
        type: "error",
        text: "Current password is required.",
      });
      setSaving(false);
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "New password must be at least 6 characters.",
      });
      setSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      setSaving(false);
      return;
    }

    // Verify current password before allowing change
    const { error: verifyError } =
      await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

    if (verifyError) {
      setMessage({
        type: "error",
        text: "Current password is incorrect.",
      });
      setSaving(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setMessage({ type: "success", text: "Password updated successfully!" });
      form.reset();
    }
  }

  return (
    <>
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="current_password">Current Password</Label>
          <Input
            id="current_password"
            name="current_password"
            type="password"
            required
            placeholder="Enter your current password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new_password">New Password</Label>
          <Input
            id="new_password"
            name="new_password"
            type="password"
            required
            minLength={6}
            placeholder="At least 6 characters"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm_password">Confirm New Password</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            minLength={6}
          />
        </div>
        <div>
          <Button type="submit" disabled={saving} size="sm">
            {saving ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </form>
    </>
  );
}

function DeleteAccountButton() {
  const { supabase, user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!user) return;
    if (confirmText !== "DELETE") return;

    setDeleting(true);
    setError(null);

    // Soft delete: set is_deactivated = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("profiles") as any)
      .update({ is_deactivated: true })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setDeleting(false);
      return;
    }

    // Sign out the user
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4" />
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Your Account</DialogTitle>
          <DialogDescription>
            This will deactivate your account. Your data will be retained for 30
            days before permanent deletion. During this period, you can contact
            support to restore your account.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="confirm_delete">
            Type <span className="font-mono font-bold">DELETE</span> to confirm
          </Label>
          <Input
            id="confirm_delete"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} size="sm">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={confirmText !== "DELETE" || deleting}
            size="sm"
          >
            {deleting ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
