import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAdminEmail } from "@/lib/auth/admin";

const PROTECTED_ROUTES = ["/picks", "/profile", "/friends", "/notifications", "/live", "/settings", "/analytics"];
const PUBLIC_EXCEPTIONS = ["/picks/share/"];
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Admin routes: return 404 for non-admins (hides the admin surface entirely)
  // Guard both UI (/admin) and API (/api/admin) routes, but exclude
  // /api/admin/check so non-admins can determine whether to show the admin nav link.
  if (
    pathname.startsWith("/admin") ||
    (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/check"))
  ) {
    if (!user || !isAdminEmail(user.email ?? "")) {
      return NextResponse.rewrite(new URL("/not-found", request.url));
    }
    return response;
  }

  // Allow public exception paths even if they match a protected route prefix
  const isPublicException = PUBLIC_EXCEPTIONS.some((ex) => pathname.startsWith(ex));

  // Redirect unauthenticated users from protected routes to login
  if (!user && !isPublicException && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const propsUrl = request.nextUrl.clone();
    propsUrl.pathname = "/props";
    return NextResponse.redirect(propsUrl);
  }

  // Redirect signed-in users from landing page to props
  if (user && pathname === "/") {
    const propsUrl = request.nextUrl.clone();
    propsUrl.pathname = "/props";
    return NextResponse.redirect(propsUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
