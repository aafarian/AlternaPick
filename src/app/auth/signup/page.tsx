"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signUp } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedInput } from "@/components/ui/animated-input";
import { AnimatedButton } from "@/components/ui/animated-button";
import { SlideUp } from "@/components/motion";
import { StaggerChildren, StaggerItem } from "@/components/motion";
import { AnimatePresence, motion, useReducedMotion } from "@/lib/motion";
import { AlertCircle } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const prefersReduced = useReducedMotion();

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

    // Step 2: Sign in on the client so onAuthStateChange fires -> nav updates
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

    // Step 4: Navigate -- auth context will have the user by now
    router.push("/picks");
  }

  async function handleGoogleSignIn() {
    const supabase = createClient();
    const ref = refParam || localStorage.getItem("sports_tower_ref");
    // Persist ref for the OAuth redirect flow
    if (ref) {
      localStorage.setItem("sports_tower_ref", ref);
      // Also set a cookie so the server-side callback route can read it
      document.cookie = `ap_ref=${encodeURIComponent(ref)}; path=/; max-age=3600; SameSite=Lax`;
    }
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fcards`,
      },
    });
  }

  return (
    <>
      <SlideUp duration={0.5} offset={24}>
        <Card className="border-border bg-card relative overflow-hidden border-primary/10 shadow-[0_0_30px_rgba(0,210,106,0.06)]">
          <CardContent className="p-6">
            <StaggerChildren staggerDelay={0.08}>
              {/* ---- Heading ---- */}
              <StaggerItem>
                <h2 className="mb-6 text-xl font-semibold">Create Account</h2>
              </StaggerItem>

              {/* ---- Referral banner with highlight glow ---- */}
              <AnimatePresence>
                {refParam && (
                  <motion.div
                    key="referral-banner"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <div
                      className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center text-sm"
                      style={
                        !prefersReduced
                          ? { animation: "referral-glow 1.5s ease-out 0.5s 1 both" }
                          : undefined
                      }
                    >
                      Invited by{" "}
                      <span className="font-semibold text-primary">
                        @{refParam}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ---- Error alert ---- */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    key="error-alert"
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ---- Form ---- */}
              <StaggerItem>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSignUp(new FormData(e.currentTarget));
                  }}
                  className="flex flex-col gap-4"
                >
                  <AnimatedInput
                    id="username"
                    name="username"
                    type="text"
                    label="Username"
                    required
                    pattern="^[a-zA-Z0-9_]{3,20}$"
                    title="3-20 characters, letters, numbers and underscores"
                    autoComplete="username"
                  />

                  <AnimatedInput
                    id="email"
                    name="email"
                    type="email"
                    label="Email"
                    required
                    autoComplete="email"
                  />

                  <div>
                    <AnimatedInput
                      id="password"
                      name="password"
                      type="password"
                      label="Password"
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Minimum 6 characters
                    </p>
                  </div>

                  <AnimatedButton
                    type="submit"
                    loading={submitting}
                    loadingText="Creating account..."
                    disabled={submitting}
                  >
                    Create Account
                  </AnimatedButton>
                </form>
              </StaggerItem>

              {/* ---- Separator ---- */}
              <StaggerItem>
                <div className="my-4 flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>
              </StaggerItem>

              {/* ---- Google sign-in ---- */}
              <StaggerItem>
                <AnimatedButton
                  onClick={handleGoogleSignIn}
                  variant="outline"
                  className="w-full"
                >
                  Continue with Google
                </AnimatedButton>
              </StaggerItem>

              {/* ---- Login link ---- */}
              <StaggerItem>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    href="/auth/login"
                    className="text-primary hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </StaggerItem>
            </StaggerChildren>
          </CardContent>
        </Card>
      </SlideUp>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
      <SignupForm />
    </Suspense>
  );
}
