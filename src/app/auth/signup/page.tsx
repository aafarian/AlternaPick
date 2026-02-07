"use client";

import Link from "next/link";
import { useState } from "react";
import { signUp } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSignUp(formData: FormData) {
    setError(null);
    setSuccess(null);
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(result.success);
    }
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fcards`,
      },
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h2 className="mb-6 text-xl font-semibold">Create Account</h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-400">
          {success}
        </div>
      )}

      <form action={handleSignUp} className="flex flex-col gap-4">
        <div>
          <label htmlFor="username" className="mb-1 block text-sm text-muted">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            pattern="^[a-zA-Z0-9_]{3,20}$"
            title="3-20 characters, letters, numbers and underscores"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-muted">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted">Minimum 6 characters</p>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
        >
          Create Account
        </button>
      </form>

      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <button
        onClick={handleGoogleSignIn}
        className="w-full rounded-lg border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-hover"
      >
        Continue with Google
      </button>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
