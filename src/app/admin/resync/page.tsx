import type { Metadata } from "next";
import DataResync from "@/components/admin/DataResync";

export const metadata: Metadata = {
  title: "Admin - Resync",
};

export default function AdminResyncPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Data Resync</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Rebuild derived stats from source-of-truth data. Run steps in order for
        a full recovery.
      </p>
      <div className="mt-6">
        <DataResync />
      </div>
    </div>
  );
}
