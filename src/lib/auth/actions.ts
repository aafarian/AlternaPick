"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimAnonymousCards } from "@/lib/auth/claim-cards";
import { logError } from "@/lib/logger";

/**
 * Resolves a login identifier (email or username) to an email address.
 * The actual signInWithPassword happens client-side so onAuthStateChange fires.
 */
export async function resolveLoginEmail(login: string) {
  if (!login) return { error: "Email or username is required" };

  // Already an email — return as-is
  if (login.includes("@")) return { email: login };

  // Username → look up the associated email
  const admin = createAdminClient();
   
  const { data: profile } = await (admin.from("profiles") as any)
    .select("id")
    .ilike("username", login)
    .maybeSingle() as { data: { id: string } | null };

  if (!profile) return { error: "Invalid username or password" };

  const { data: userData } = await admin.auth.admin.getUserById(profile.id);
  if (!userData?.user?.email) return { error: "Invalid username or password" };

  return { email: userData.user.email };
}

/**
 * Claims anonymous cards after sign-in (called client-side after successful auth).
 */
export async function claimCardsAfterLogin() {
  const cookieStore = await cookies();
  const anonId = cookieStore.get("ap_anon_id")?.value;
  if (!anonId) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await claimAnonymousCards(user.id, anonId);
    cookieStore.delete("ap_anon_id");
  }
}

/**
 * Creates a new account. The actual sign-in happens client-side after this returns.
 */
export async function signUp(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const username = formData.get("username") as string;

  if (!email || !password || !username) {
    return { error: "All fields are required" };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters" };
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return { error: "Username must be 3-20 characters, alphanumeric and underscores only" };
  }

  const admin = createAdminClient();

  // Check username availability (case-insensitive)
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existing) {
    return { error: "Username already taken" };
  }

  // Use admin API — gives actual error details instead of GoTrue's generic message
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    user_metadata: { username },
    email_confirm: true,
  });

  if (error) {
    logError("auth-actions", "signUp error", undefined, error);
    return { error: error.message };
  }

  // Ensure profile exists (trigger should handle this, but belt-and-suspenders)
  if (data.user) {
     
    const { error: profileError } = await (admin.from("profiles") as any).upsert(
      {
        id: data.user.id,
        username,
        username_chosen_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      logError("auth-actions", "signUp profile upsert error", undefined, profileError);
    }

    // Ensure leaderboard entry exists
     
    await (admin.from("leaderboard_entries") as any).upsert(
      { user_id: data.user.id },
      { onConflict: "user_id" }
    );
  }

  // Return success — client will handle sign-in so onAuthStateChange fires
  return { success: true };
}

/**
 * Updates the authenticated user's username.
 * Validates format, checks availability, and updates the profile.
 */
export async function updateUsername(username: string) {
  const trimmed = username.trim();

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(trimmed)) {
    return { error: "Username must be 3-20 characters, alphanumeric and underscores only" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  // Case-insensitive availability check (exclude current user's own row)
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .ilike("username", trimmed)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    return { error: "Username already taken" };
  }

   
  const { error } = await (admin.from("profiles") as any)
    .update({ username: trimmed, username_chosen_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    logError("auth-actions", "updateUsername error", undefined, error);
    return { error: "Failed to update username" };
  }

  return { success: true };
}

/**
 * Marks the username prompt as dismissed without changing the username.
 * Called when the user clicks "Skip" on the UsernameSetupModal — they keep
 * whatever auto-generated handle they have, but we don't re-prompt them.
 */
export async function dismissUsernamePrompt() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { error } = await (admin.from("profiles") as any)
    .update({ username_chosen_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    logError("auth-actions", "dismissUsernamePrompt error", undefined, error);
    return { error: "Failed to dismiss prompt" };
  }

  return { success: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
