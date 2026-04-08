import AuthLayoutClient from "./AuthLayoutClient";
import { noIndexMetadata } from "@/lib/seo/metadata";

// Auth pages have nothing useful to index — Googlebot would just see a
// login form. noindex them so they don't waste crawl budget or compete
// with marketing pages for ranking.
export const metadata = noIndexMetadata;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthLayoutClient>{children}</AuthLayoutClient>;
}
