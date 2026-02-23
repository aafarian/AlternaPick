import type { Metadata } from "next";
import UserDetail from "@/components/admin/UserDetail";

export const metadata: Metadata = {
  title: "Admin - User Detail",
};

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return <UserDetail userId={userId} />;
}
