import type { Metadata } from "next";
import FeatureFlagSettings from "@/components/admin/FeatureFlagSettings";

export const metadata: Metadata = {
  title: "Admin - Settings",
};

export default function AdminSettingsPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage feature flags, email settings, and platform toggles.
      </p>
      <div className="mt-6">
        <FeatureFlagSettings />
      </div>
    </div>
  );
}
