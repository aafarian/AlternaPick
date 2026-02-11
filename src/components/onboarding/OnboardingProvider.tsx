"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import OnboardingModal from "./OnboardingModal";

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, loading, supabase } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (loading || !user || !supabase) return;

    async function checkOnboardingStatus() {
      const { data } = await (supabase.from("profiles") as any)
        .select("onboarding_completed")
        .eq("id", user!.id)
        .single();

      const profile = data as { onboarding_completed: boolean } | null;

      if (profile && !profile.onboarding_completed) {
        setShowOnboarding(true);
      }
    }

    checkOnboardingStatus();
  }, [user, loading, supabase]);

  async function handleDismiss() {
    setShowOnboarding(false);

    if (user && supabase) {
      await (supabase.from("profiles") as any)
        .update({ onboarding_completed: true })
        .eq("id", user.id);
    }
  }

  return (
    <>
      {children}
      <OnboardingModal open={showOnboarding} onDismiss={handleDismiss} />
    </>
  );
}
