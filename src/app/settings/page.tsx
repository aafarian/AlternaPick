import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Bell, Shield } from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/settings");
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="profile" className="gap-1.5">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-1.5">
            <Shield className="h-4 w-4" />
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Profile Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your display name, avatar, and public profile information.
            </p>
            <div className="mt-6 text-sm text-muted-foreground">
              Profile editing coming soon.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Notification Preferences</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Control which notifications you receive and how they are delivered.
            </p>
            <div className="mt-6 text-sm text-muted-foreground">
              Notification preferences coming soon.
            </div>
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold">Account Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your email, password, and account preferences.
            </p>
            <div className="mt-6 text-sm text-muted-foreground">
              Account settings coming soon.
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
