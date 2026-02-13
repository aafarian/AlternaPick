"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import OnboardingModal from "./OnboardingModal";
import UsernameSetupModal from "./UsernameSetupModal";

const AUTO_USERNAME_RE = /^user_[a-f0-9]{8}$/;

type Phase = "idle" | "username_setup" | "onboarding" | "done";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, loading, supabase } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    if (loading || !user || !supabase) return;

    async function checkStatus() {
      // Query username separately first — it's guaranteed to exist in the schema.
      // onboarding_completed may not exist if migrations are pending.
      const { data, error } = await (supabase.from("profiles") as any)
        .select("username")
        .eq("id", user!.id)
        .single();

      if (error || !data) return;

      const username = (data as { username: string }).username;

      // Auto-generated username from Google OAuth → prompt to pick a real one
      if (AUTO_USERNAME_RE.test(username)) {
        setPhase("username_setup");
        return;
      }

      // Check onboarding status (column may not exist — default to showing onboarding)
      const { data: full } = await (supabase.from("profiles") as any)
        .select("onboarding_completed")
        .eq("id", user!.id)
        .single();

      const onboardingCompleted = (full as { onboarding_completed?: boolean } | null)
        ?.onboarding_completed ?? false;

      if (!onboardingCompleted) {
        setPhase("onboarding");
      } else {
        setPhase("done");
      }
    }

    checkStatus();
  }, [user, loading, supabase]);

  function handleUsernameComplete() {
    // After username step, check if onboarding is still needed
    // Re-fetch would be ideal, but we know that if we got to username_setup,
    // onboarding_completed was checked. Google OAuth users are always new,
    // so they'll need the onboarding slideshow too.
    setPhase("onboarding");
  }

  async function handleOnboardingDismiss() {
    setPhase("done");

    if (user && supabase) {
      await (supabase.from("profiles") as any)
        .update({ onboarding_completed: true })
        .eq("id", user.id);
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
