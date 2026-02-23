import type { Metadata } from "next";
import CardDetail from "@/components/admin/CardDetail";

export const metadata: Metadata = {
  title: "Admin - Card Detail",
};

export default async function AdminCardDetailPage({
  params,
}: {
  params: Promise<{ cardId: string }>;
}) {
  const { cardId } = await params;

  return <CardDetail cardId={cardId} />;
}
