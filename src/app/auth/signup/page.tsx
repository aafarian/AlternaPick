"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Detect referral query param (?ref=username)
  const refParam = searchParams.get("ref");

  // Persist ref in localStorage so it survives OAuth redirects
  useEffect(() => {
    if (refParam) {
      localStorage.setItem("sports_tower_ref", refParam);
    }
  }, [refParam]);

  /**
   * Process referral after successful signup.
   * Reads from URL param or localStorage fallback (for OAuth flow).
   */
  async function processReferralIfNeeded() {
    const referrer =
      refParam || localStorage.getItem("sports_tower_ref");
    if (!referrer) return;

    try {
      await fetch("/api/referrals/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrer_username: referrer }),
      });
    } catch {
      // Non-fatal: referral processing failure should not block signup flow
      console.error("Failed to process referral");
    } finally {
      localStorage.removeItem("sports_tower_ref");
    }
  }

  async function handleSignUp(formData: FormData) {
    setError(null);
    setSubmitting(true);

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    // Step 1: Create account on server (admin API)
    const result = await signUp(formData);
    if (result?.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    // Step 2: Sign in on the client so onAuthStateChange fires → nav updates
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError("Account created but sign-in failed. Please sign in manually.");
      setSubmitting(false);
      return;
    }

    // Step 3: Process referral if the user came via a referral link
    await processReferralIfNeeded();

    // Step 4: Navigate — auth context will have the user by now
    router.push("/picks");
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    const ref = refParam || localStorage.getItem("sports_tower_ref");
    // Persist ref for the OAuth redirect flow
    if (ref) {
      localStorage.setItem("sports_tower_ref", ref);
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fcards`,
      },
    });
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <h2 className="mb-6 text-xl font-semibold">Create Account</h2>

        {refParam && (
          <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-center text-sm">
            Invited by <span className="font-semibold text-primary">@{refParam}</span>
          </div>
        )}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form action={handleSignUp} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              required
              pattern="^[a-zA-Z0-9_]{3,20}$"
              title="3-20 characters, letters, numbers and underscores"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">Minimum 6 characters</p>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button
          onClick={handleGoogleSignIn}
          variant="outline"
          className="w-full"
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <SignupForm />
    </Suspense>
  );
}
