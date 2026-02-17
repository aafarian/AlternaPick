"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { resolveLoginEmail, claimCardsAfterLogin } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { AnimatedInput } from "@/components/ui/animated-input";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerChildren, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { AlertCircle } from "lucide-react";

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const redirectTo = searchParams.get("redirectTo") ?? "/picks";
  const prefersReduced = useReducedMotion();

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
    await claimCardsAfterLogin().catch((err) => {
      console.error("Failed to claim anonymous cards after login:", err);
    });

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
    <>
      <motion.div
        className={cn(
          "rounded-xl border border-border bg-card p-6",
          !prefersReduced && "card-border-glow"
        )}
        style={
          !prefersReduced
            ? { animation: "card-border-glow 3s ease-in-out infinite" }
            : undefined
        }
        initial={prefersReduced ? false : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      >
        <StaggerChildren staggerDelay={0.08} className="flex flex-col">
          {/* ── Heading ── */}
          <StaggerItem>
            <h2 className="mb-6 text-xl font-semibold">Sign In</h2>
          </StaggerItem>

          {/* ── Error alert with AnimatePresence ── */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error-alert"
                initial={prefersReduced ? false : { opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={prefersReduced ? undefined : { opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Form ── */}
          <StaggerItem>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSignIn(new FormData(e.currentTarget));
              }}
              className="flex flex-col gap-4"
            >
              <AnimatedInput
                id="login"
                name="login"
                type="text"
                label="Email or Username"
                autoComplete="username"
                required
              />

              <AnimatedInput
                id="password"
                name="password"
                type="password"
                label="Password"
                required
                minLength={6}
              />

              <AnimatedButton
                type="submit"
                disabled={submitting}
                loading={submitting}
                loadingText="Signing in..."
              >
                Sign In
              </AnimatedButton>
            </form>
          </StaggerItem>

          {/* ── Forgot password ── */}
          <StaggerItem>
            <div className="mt-2 text-right">
              <Link
                href="/auth/reset-password"
                className="text-xs text-muted-foreground hover:text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </StaggerItem>

          {/* ── Separator ── */}
          <StaggerItem>
            <div className="my-4 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>
          </StaggerItem>

          {/* ── Google sign-in ── */}
          <StaggerItem>
            <AnimatedButton
              onClick={handleGoogleSignIn}
              variant="outline"
              className="w-full"
            >
              Continue with Google
            </AnimatedButton>
          </StaggerItem>

          {/* ── Sign-up link ── */}
          <StaggerItem>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </p>
          </StaggerItem>
        </StaggerChildren>
      </motion.div>
    </>
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
