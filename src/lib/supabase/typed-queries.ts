/**
 * Typed Supabase query wrappers.
 *
 * The Supabase JS client's generic types resolve relationship joins and
 * complex chained queries (`.from().select().eq()`) to `never`, forcing
 * call-sites to cast via `as any`. These helpers centralise that single
 * cast so the rest of the codebase stays free of `any`.
 *
 * Usage:
 *   import { typedFrom } from "@/lib/supabase/typed-queries";
 *   const { data, error } = await typedFrom(supabase, "profiles")
 *     .select("id, username")
 *     .eq("id", userId)
 *     .single();
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

type TableName = keyof Database["public"]["Tables"];

 
type QueryBuilder = any;

/**
 * Returns a typed query builder for the given table.
 * Centralises the single `as any` cast required by Supabase's generic
 * types when using relationship joins or complex chaining.
 */
export function typedFrom(
  supabase: SupabaseClient<Database>,
  table: TableName
): QueryBuilder {
   
  return supabase.from(table) as any;
}

/**
 * Execute a SELECT query and return typed rows.
 * Useful for simple selects without joins.
 */
export async function typedSelect<T>(
  supabase: SupabaseClient<Database>,
  table: TableName,
  columns: string = "*",
  options?: { count?: "exact"; head?: boolean }
): Promise<{ data: T[] | null; error: Error | null; count: number | null }> {
  const { data, error, count } = await typedFrom(supabase, table).select(
    columns,
    options
  );
  return { data: data as T[] | null, error, count: count ?? null };
}

/**
 * Execute an INSERT query and return the inserted row.
 */
export async function typedInsert<T>(
  supabase: SupabaseClient<Database>,
  table: TableName,
  values: Record<string, unknown>,
  options?: { returnRow?: boolean }
): Promise<{ data: T | null; error: Error | null }> {
  let query = typedFrom(supabase, table).insert(values);
  if (options?.returnRow !== false) {
    query = query.select().single();
  }
  const { data, error } = await query;
  return { data: data as T | null, error };
}

/**
 * Execute an UPDATE query and return the updated row.
 */
export async function typedUpdate(
  supabase: SupabaseClient<Database>,
  table: TableName,
  values: Record<string, unknown>
): Promise<{
  builder: QueryBuilder;
}> {
  return { builder: typedFrom(supabase, table).update(values) };
}
