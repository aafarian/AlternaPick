"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import OnboardingModal from "./OnboardingModal";
import UsernameSetupModal from "./UsernameSetupModal";

type Phase = "idle" | "username_setup" | "onboarding" | "done";

const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 1_000;

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, loading, supabase } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");

  // Derive a stable primitive so the effect doesn't re-run on every
  // onAuthStateChange event (each event produces a new user object ref).
  const userId = user?.id ?? null;
  const resolvedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !userId || !supabase) return;
    if (resolvedForRef.current === userId) return;

    let cancelled = false;

    async function checkStatus(attempt = 0) {
       
      const { data, error } = await (supabase.from("profiles") as any)
        .select("username, username_chosen_at, onboarding_completed")
        .eq("id", userId)
        .single();

      if (cancelled) return;

      if ((error || !data) && attempt < MAX_RETRIES) {
        setTimeout(() => {
          if (!cancelled) checkStatus(attempt + 1);
        }, RETRY_INTERVAL_MS);
        return;
      }

      if (error || !data) return;

      const profile = data as {
        username: string;
        username_chosen_at: string | null;
        onboarding_completed?: boolean;
      };

      resolvedForRef.current = userId;

      // Trust the explicit flag — `username_chosen_at` is set by signUp,
      // updateUsername, and dismissUsernamePrompt, and is backfilled to
      // NOW() for non-auto rows by migration 049. NULL means the user has
      // never been prompted (or has been prompted but not responded).
      if (profile.username_chosen_at == null) {
        setPhase("username_setup");
        return;
      }

      if (!profile.onboarding_completed) {
        setPhase("onboarding");
      } else {
        setPhase("done");
      }
    }

    checkStatus();
    return () => {
      cancelled = true;
    };
     
  }, [userId, loading, supabase]);

  function handleUsernameComplete() {
    setPhase("onboarding");
  }

  async function handleOnboardingDismiss() {
    setPhase("done");

    if (userId && supabase) {
       
      await (supabase.from("profiles") as any)
        .update({ onboarding_completed: true })
        .eq("id", userId);
    }
  }

  return (
    <>
      {children}
      <UsernameSetupModal
        open={phase === "username_setup"}
        onComplete={handleUsernameComplete}
      />
      <OnboardingModal
        open={phase === "onboarding"}
        onDismiss={handleOnboardingDismiss}
      />
    </>
  );
}
