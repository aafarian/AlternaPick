import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";

/**
 * GET /api/admin/check
 * Lightweight admin check endpoint.
 * Returns { isAdmin: boolean } without exposing admin emails client-side.
 * Returns false (not an error) for unauthenticated or non-admin users.
 */
export async function GET() {
  try {
    const result = await isAdmin();
    return NextResponse.json({ isAdmin: result.isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
