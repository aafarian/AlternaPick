import type { Metadata } from "next";
import SystemHealth from "@/components/admin/SystemHealth";

export const metadata: Metadata = {
  title: "Admin - System",
};

export default function AdminSystemPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">System Health</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Monitor prop sync, game schedule, and error indicators.
      </p>
      <div className="mt-6">
        <SystemHealth />
      </div>
    </div>
  );
}
