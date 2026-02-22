import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, NotificationPreferences } from "@/lib/supabase/types";
import { parseIconConfig } from "@/lib/icons/parse";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield } from "lucide-react";
import ProfileSection from "@/components/settings/ProfileSection";
import NotificationPreferencesSection from "@/components/settings/NotificationPreferencesSection";
import AccountSection from "@/components/settings/AccountSection";
import { SlideUp, FadeIn } from "@/components/motion";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/settings");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const typedProfile = profile as Profile | null;

  // Determine auth provider info from user identities
  const identities = user.identities ?? [];
  const hasGoogleProvider = identities.some(
    (identity) => identity.provider === "google"
  );
  const hasPasswordProvider = identities.some(
    (identity) => identity.provider === "email"
  );

  return (
    <div className="flex flex-col gap-6 py-8">
      <SlideUp>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </SlideUp>

      <FadeIn delay={0.1}>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="profile" className="gap-1.5 duration-200">
              <User className="h-4 w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 duration-200">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-1.5 duration-200">
              <Shield className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <FadeIn delay={0.15}>
              <ProfileSection
                avatarUrl={typedProfile?.avatar_url ?? null}
                iconConfig={parseIconConfig(typedProfile?.icon_config)}
                userId={user.id}
                username={typedProfile?.username ?? user.email?.split("@")[0] ?? "user"}
              />
            </FadeIn>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <FadeIn delay={0.15}>
              <NotificationPreferencesSection
                initialPreferences={
                  (typedProfile?.notification_preferences as NotificationPreferences | null) ?? null
                }
              />
            </FadeIn>
          </TabsContent>

          <TabsContent value="account" className="mt-6">
            <FadeIn delay={0.15}>
              <AccountSection
                email={user.email ?? ""}
                hasGoogleProvider={hasGoogleProvider}
                hasPasswordProvider={hasPasswordProvider}
              />
            </FadeIn>
          </TabsContent>
        </Tabs>
      </FadeIn>
    </div>
  );
}
