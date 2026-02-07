import type { User, Session } from "@supabase/supabase-js";

export type AuthUser = User;
export type AuthSession = Session;

export interface AuthState {
  user: AuthUser | null;
  loading: boolean;
}
