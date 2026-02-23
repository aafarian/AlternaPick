import type { Metadata } from "next";
import UsersTable from "@/components/admin/UsersTable";

export const metadata: Metadata = {
  title: "Admin - Users",
};

export default function AdminUsersPage() {
  return (
    <div>
      <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Search, browse, and manage all platform users.
      </p>
      <div className="mt-6">
        <UsersTable />
      </div>
    </div>
  );
}
