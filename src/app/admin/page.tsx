import type { Metadata } from "next";
import OverviewStats from "@/components/admin/OverviewStats";
import DetailedOverview from "@/components/admin/DetailedOverview";

export const metadata: Metadata = {
  title: "Admin - Overview",
};

export default function AdminOverviewPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Platform Overview</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Key metrics and platform-wide stats.
      </p>
      <div className="mt-6">
        <OverviewStats />
      </div>
      <div className="mt-8">
        <DetailedOverview />
      </div>
    </div>
  );
}
