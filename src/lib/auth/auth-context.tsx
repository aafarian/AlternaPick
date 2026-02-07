"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthUser } from "./types";
import type { Database } from "@/lib/supabase/types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  supabase: SupabaseClient<Database>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseRef = useRef<SupabaseClient<Database> | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  if (!supabaseRef.current && typeof window !== "undefined") {
    supabaseRef.current = createClient();
  }

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Provide a dummy context during SSR
  if (!supabaseRef.current) {
    return <>{children}</>;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, supabase: supabaseRef.current }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    // During SSR or outside provider, return safe defaults
    return {
      user: null,
      loading: true,
      supabase: null as unknown as SupabaseClient<Database>,
    };
  }
  return context;
}
