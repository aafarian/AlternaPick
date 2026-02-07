import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PROTECTED_ROUTES = ["/cards", "/history", "/profile"];
const AUTH_ROUTES = ["/auth/login", "/auth/signup"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Redirect unauthenticated users from protected routes to login
  if (!user && PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && AUTH_ROUTES.some((route) => pathname.startsWith(route))) {
    const cardsUrl = request.nextUrl.clone();
    cardsUrl.pathname = "/cards";
    return NextResponse.redirect(cardsUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
