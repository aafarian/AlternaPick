import type { Metadata } from "next";
import RecordLookup from "@/components/admin/RecordLookup";

export const metadata: Metadata = {
  title: "Admin - Lookup",
};

export default function AdminLookupPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Record Lookup</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste any UUID to find the record.
      </p>
      <div className="mt-6">
        <RecordLookup />
      </div>
    </div>
  );
}
