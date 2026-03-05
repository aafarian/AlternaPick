import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import { logError, logWarn } from "@/lib/logger";
import type { FeatureFlag } from "@/lib/supabase/types";
import { ENV_VAR_MAP } from "./types";
import type { FlagKey } from "./types";

export type { FlagKey, FlagType } from "./types";
export { ENV_VAR_MAP } from "./types";

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 30_000; // 30 seconds

interface CachedFlag {
  flag: FeatureFlag;
  cachedAt: number;
}

interface CachedAllFlags {
  flags: FeatureFlag[];
  cachedAt: number;
}

const flagCache = new Map<string, CachedFlag>();
let allFlagsCache: CachedAllFlags | null = null;

function isCacheValid(cachedAt: number): boolean {
  return Date.now() - cachedAt < CACHE_TTL_MS;
}

// ---------------------------------------------------------------------------
// getFlag
// ---------------------------------------------------------------------------

/**
 * Fetch a single feature flag row by key.
 *
 * Resolution order:
 * 1. In-memory cache (if within TTL)
 * 2. Supabase `feature_flags` table
 *
 * Returns `null` when the flag doesn't exist or the DB query fails.
 */
export async function getFlag(key: string): Promise<FeatureFlag | null> {
  // 1. Check per-key cache
  const cached = flagCache.get(key);
  if (cached && isCacheValid(cached.cachedAt)) {
    return cached.flag;
  }

  // 2. Query DB
  try {
    const supabase = createAdminClient();
    const { data, error } = await typedFrom(supabase, "feature_flags")
      .select("*")
      .eq("key", key)
      .single();

    if (error || !data) {
      logWarn("feature-flags", `Flag "${key}" not found in DB`);
      return null;
    }

    const flag = data as FeatureFlag;
    flagCache.set(key, { flag, cachedAt: Date.now() });
    return flag;
  } catch (err) {
    logError("feature-flags", `Failed to fetch flag "${key}"`, undefined, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// getFlagValue
// ---------------------------------------------------------------------------

/**
 * Resolve a flag's value with env var fallback.
 *
 * 1. If the flag exists in DB and is enabled, return `flag.value`.
 * 2. Otherwise fall back to the env var mapped by `ENV_VAR_MAP` (or the
 *    flag's own `env_var_fallback` column).
 * 3. Returns `null` when neither source provides a value.
 */
export async function getFlagValue(key: string): Promise<string | null> {
  const flag = await getFlag(key);

  if (flag && flag.enabled) {
    return flag.value;
  }

  // Determine env var name: prefer DB column, then static map
  const envVarName =
    flag?.env_var_fallback ?? ENV_VAR_MAP[key as FlagKey] ?? null;

  if (envVarName) {
    return process.env[envVarName] ?? null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// getAllFlags
// ---------------------------------------------------------------------------

/**
 * Fetch every feature flag row.
 *
 * Returns cached result when within TTL.
 * Returns an empty array on DB error.
 */
export async function getAllFlags(): Promise<FeatureFlag[]> {
  if (allFlagsCache && isCacheValid(allFlagsCache.cachedAt)) {
    return allFlagsCache.flags;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await typedFrom(supabase, "feature_flags")
      .select("*")
      .order("key");

    if (error) {
      logError("feature-flags", "Failed to fetch all flags", undefined, error);
      return [];
    }

    const flags = (data ?? []) as FeatureFlag[];
    allFlagsCache = { flags, cachedAt: Date.now() };
    return flags;
  } catch (err) {
    logError("feature-flags", "Failed to fetch all flags", undefined, err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// setFlag
// ---------------------------------------------------------------------------

/**
 * Update a feature flag in the DB and invalidate caches.
 *
 * Returns `true` on success, `false` on error.
 */
export async function setFlag(
  key: string,
  updates: { value?: string; enabled?: boolean },
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await typedFrom(supabase, "feature_flags")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("key", key);

    if (error) {
      logError("feature-flags", `Failed to update flag "${key}"`, undefined, error);
      return false;
    }

    // Invalidate caches
    invalidateCache();
    return true;
  } catch (err) {
    logError("feature-flags", `Failed to update flag "${key}"`, undefined, err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// invalidateCache
// ---------------------------------------------------------------------------

/** Clear both per-key and all-flags caches. */
export function invalidateCache(): void {
  flagCache.clear();
  allFlagsCache = null;
}
