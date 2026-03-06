import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/supabase/types";
import type { AuthUser } from "./types";
import { logError } from "@/lib/logger";

export const PROTECTED_ROUTES = ["/picks", "/profile", "/friends", "/challenges"];
export const AUTH_ROUTES = ["/auth/login", "/auth/signup"];

export async function getCurrentUser(
  supabase: SupabaseClient<Database>
): Promise<AuthUser | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(
  supabase: SupabaseClient<Database>
): Promise<AuthUser> {
  const user = await getCurrentUser(supabase);
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export async function getUserProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error && error.code !== "PGRST116") {
    logError("auth", `getUserProfile failed for ${userId}`, undefined, error);
  }
  return data;
}

export class AuthRequiredError extends Error {
  public status = 401;
  constructor() {
    super("Authentication required");
    this.name = "AuthRequiredError";
  }
}
