"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { claimAnonymousCards } from "@/lib/auth/claim-cards";

export async function signIn(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = (formData.get("redirectTo") as string) || "/cards";

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Claim anonymous cards if the user had a local session
  const cookieStore = await cookies();
  const anonId = cookieStore.get("st_anon_id")?.value;
  if (anonId && data.user) {
    await claimAnonymousCards(data.user.id, anonId);
    cookieStore.delete("st_anon_id");
  }

  redirect(redirectTo);
}

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        display_name: username,
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: "Check your email to confirm your account!" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
