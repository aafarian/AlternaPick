import type { Metadata } from "next";
import ChallengeDetail from "@/components/admin/ChallengeDetail";

export const metadata: Metadata = {
  title: "Admin - Challenge Detail",
};

export default async function AdminChallengeDetailPage({
  params,
}: {
  params: Promise<{ challengeId: string }>;
}) {
  const { challengeId } = await params;

  return <ChallengeDetail challengeId={challengeId} />;
}
