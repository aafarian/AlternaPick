/** Known flag types stored in the `flag_type` column. */
export type FlagType = "boolean" | "string" | "string_list" | "number";

/** Known flag keys. Extend this union as new flags are added. */
export type FlagKey = "email_allowlist" | "admin_emails" | "email_enabled";

/**
 * Maps each known flag key to its corresponding env var name.
 * Used as the fallback when the DB is unavailable or the flag row
 * doesn't have an `env_var_fallback` value.
 */
export const ENV_VAR_MAP: Record<FlagKey, string> = {
  email_allowlist: "EMAIL_ALLOWLIST",
  admin_emails: "ADMIN_EMAILS",
  email_enabled: "EMAIL_ENABLED",
};
