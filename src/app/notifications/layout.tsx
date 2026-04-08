import { noIndexMetadata } from "@/lib/seo/metadata";

// Personal notifications inbox — nothing useful for Googlebot to index.
export const metadata = noIndexMetadata;

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
