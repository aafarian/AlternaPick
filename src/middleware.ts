import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_ROUTES = ["/picks", "/profile", "/friends", "/challenges", "/notifications", "/live", "/settings"];
const PUBLIC_EXCEPTIONS = ["/picks/share/"];
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

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
