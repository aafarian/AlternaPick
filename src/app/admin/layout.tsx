import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminSidebar, {
  AdminMobileNav,
} from "@/components/admin/AdminSidebar";

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
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-primary">Alterna</span>
            <span className="text-foreground">Pick</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              Admin
            </span>
          </h1>
        </div>
        <Link
          href="/props"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to App
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
