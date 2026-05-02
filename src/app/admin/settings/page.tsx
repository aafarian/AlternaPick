import type { Metadata } from "next";
import FeatureFlagSettings from "@/components/admin/FeatureFlagSettings";
import HeatScoreAdmin from "@/components/admin/HeatScoreAdmin";

export const metadata: Metadata = {
  title: "Admin - Settings",
};

export default function AdminSettingsPage() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage feature flags, email settings, and platform toggles.
        </p>
        <div className="mt-6">
          <FeatureFlagSettings />
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">HeatScore</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Simulate HeatScore on resolved cards and test the multiplier table.
        </p>
        <div className="mt-6 flex flex-col gap-6">
          <HeatScoreAdmin />
        </div>
      </div>
    </div>
  );
}
