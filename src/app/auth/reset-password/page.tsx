"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimatedInput } from "@/components/ui/animated-input";
import { AnimatedButton } from "@/components/ui/animated-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScaleIn, FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const prefersReduced = useReducedMotion();

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSubmitting(true);

    const email = (formData.get("email") as string)?.trim();
    if (!email) {
      setError("Email is required");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/update-password` }
    );

    if (resetError) {
      setError(resetError.message);
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
  }

  return (
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
      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            key="success"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-4 text-center"
          >
            <ScaleIn initialScale={0.5} duration={0.5}>
              <CheckCircle2 className="h-10 w-10 text-neon-green" />
            </ScaleIn>
            <FadeIn delay={0.2}>
              <h2 className="text-xl font-semibold">Check Your Email</h2>
            </FadeIn>
            <FadeIn delay={0.35}>
              <p className="text-sm text-muted-foreground">
                If an account exists with that email, we&apos;ve sent a password
                reset link. Check your inbox (and spam folder).
              </p>
            </FadeIn>
            <FadeIn delay={0.5}>
              <Link href="/auth/login">
                <AnimatedButton variant="outline" size="sm">
                  Back to Sign In
                </AnimatedButton>
              </Link>
            </FadeIn>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={prefersReduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <StaggerChildren staggerDelay={0.08} className="flex flex-col">
              <StaggerItem>
                <h2 className="mb-2 text-xl font-semibold">Reset Password</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                  Enter the email address associated with your account and
                  we&apos;ll send you a link to reset your password.
                </p>
              </StaggerItem>

              {/* Error alert with AnimatePresence */}
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

              {/* Form */}
              <StaggerItem>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit(new FormData(e.currentTarget));
                  }}
                  className="flex flex-col gap-4"
                >
                  <AnimatedInput
                    id="email"
                    name="email"
                    type="email"
                    label="Email"
                    autoComplete="email"
                    required
                  />
                  <AnimatedButton
                    type="submit"
                    disabled={submitting}
                    loading={submitting}
                    loadingText="Sending..."
                  >
                    Send Reset Link
                  </AnimatedButton>
                </form>
              </StaggerItem>

              <StaggerItem>
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link href="/auth/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </StaggerItem>
            </StaggerChildren>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
