"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { resolveLoginEmail, claimCardsAfterLogin } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const redirectTo = searchParams.get("redirectTo") ?? "/picks";

  // If the user is already authenticated client-side (stale server cookie
  // caused the middleware redirect), bounce them back immediately.
  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, redirectTo, router]);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") ? "Authentication failed. Please try again." : null
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn(formData: FormData) {
    setError(null);
    setSubmitting(true);

    const login = formData.get("login") as string;
    const password = formData.get("password") as string;

    if (!login || !password) {
      setError("Email/username and password are required");
      setSubmitting(false);
      return;
    }

    // Step 1: Resolve username → email if needed (server action)
    const resolved = await resolveLoginEmail(login);
    if (resolved.error || !resolved.email) {
      setError(resolved.error ?? "Login failed");
      setSubmitting(false);
      return;
    }

    // Step 2: Sign in on the client so onAuthStateChange fires → nav updates
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password,
    });

    if (signInError) {
      setError("Invalid email/username or password");
      setSubmitting(false);
      return;
    }

    // Step 3: Claim anonymous cards (server action reads cookies)
    await claimCardsAfterLogin().catch(() => {});

    // Step 4: Navigate — auth context will have the user by now
    router.push(redirectTo);
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
  }

  // Don't flash the form while we check if the user is already signed in
  if (authLoading || user) {
    return <Skeleton className="h-96 rounded-xl" />;
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-6">
        <h2 className="mb-6 text-xl font-semibold">Sign In</h2>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form action={handleSignIn} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="login">Email or Username</Label>
            <Input
              id="login"
              name="login"
              type="text"
              autoComplete="username"
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
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-2 text-right">
          <Link
            href="/auth/reset-password"
            className="text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>

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
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<Skeleton className="h-96 rounded-xl" />}
    >
      <LoginForm />
    </Suspense>
  );
}
