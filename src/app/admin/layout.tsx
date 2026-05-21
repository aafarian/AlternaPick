import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminSidebar, {
  AdminMobileNav,
} from "@/components/admin/AdminSidebar";
import { noIndexMetadata } from "@/lib/seo/metadata";

export const metadata = noIndexMetadata;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Admin top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
        <div className="flex items-center gap-2">
          <AdminMobileNav />
          <Link href="/props" className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity">
            <span className="text-primary">Alterna</span>
            <span className="text-foreground">Pick</span>
          </Link>
          <span className="text-sm font-normal text-muted-foreground">
            Admin
          </span>
        </div>
        <Link
          href="/props"
          className="flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exit Admin
        </Link>
      </header>

      {/* Body: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <AdminSidebar />
        <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">{children}</main>
      </div>
    </div>
  );
}
