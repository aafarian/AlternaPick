import type { Metadata } from "next";
import ActivityFeed from "@/components/admin/ActivityFeed";

export const metadata: Metadata = {
  title: "Admin - Activity",
};

export default function AdminActivityPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Activity Feed</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Monitor all platform activity in real time.
      </p>
      <div className="mt-6">
        <ActivityFeed />
      </div>
    </div>
  );
}
