"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { FeatureFlag } from "@/lib/supabase/types";
import type { FlagType } from "@/lib/feature-flags";
import { timeAgo } from "@/lib/admin/helpers";
import {
  Settings,
  ToggleLeft,
  Type,
  List,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tracks which flag is currently being saved */
type SavingState = Record<string, boolean>;

/** Tracks per-flag feedback messages */
type FeedbackState = Record<string, { type: "success" | "error"; message: string }>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FLAG_TYPE_META: Record<FlagType, { label: string; icon: React.ElementType }> = {
  boolean: { label: "Boolean", icon: ToggleLeft },
  string: { label: "String", icon: Type },
  string_list: { label: "List", icon: List },
  number: { label: "Number", icon: Type },
};

function flagTypeLabel(flagType: string): string {
  return FLAG_TYPE_META[flagType as FlagType]?.label ?? flagType;
}

function FlagTypeIcon({ flagType }: { flagType: string }) {
  const meta = FLAG_TYPE_META[flagType as FlagType];
  if (!meta) return null;
  const Icon = meta.icon;
  return <Icon className="h-3.5 w-3.5" />;
}

/** Parse a comma-separated string into trimmed non-empty items */
function parseStringList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Join items back into a comma-separated string */
function joinStringList(items: string[]): string {
  return items.join(",");
}

/** Friendly label for known flag keys */
function flagDisplayLabel(key: string): string | null {
  const labels: Record<string, string> = {
    email_blocklist: "Email Blocklist",
    admin_emails: "Admin Emails",
  };
  return labels[key] ?? null;
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function FlagCardSkeleton() {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Toggle switch (no external Switch component needed)
// ---------------------------------------------------------------------------

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full
        border-2 border-transparent transition-colors
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:cursor-not-allowed disabled:opacity-50
        ${checked ? "bg-emerald-600" : "bg-muted-foreground/30"}
      `}
    >
      <span
        className={`
          pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg
          ring-0 transition-transform
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// String list tag editor
// ---------------------------------------------------------------------------

function TagEditor({
  items,
  onChange,
  disabled,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState("");

  function addItem() {
    const trimmed = inputValue.trim();
    if (!trimmed || items.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...items, trimmed]);
    setInputValue("");
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      addItem();
    }
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <Badge
              key={`${item}-${index}`}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              <span className="max-w-[200px] truncate">{item}</span>
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={disabled}
                className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5 disabled:opacity-50"
                aria-label={`Remove ${item}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Add item..."}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addItem}
          disabled={disabled || !inputValue.trim()}
          className="gap-1 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual flag card
// ---------------------------------------------------------------------------

function FlagCard({
  flag,
  saving,
  feedback,
  onUpdate,
}: {
  flag: FeatureFlag;
  saving: boolean;
  feedback: { type: "success" | "error"; message: string } | undefined;
  onUpdate: (key: string, updates: { value?: string; enabled?: boolean }) => void;
}) {
  const flagType = flag.flag_type as FlagType;
  const friendlyLabel = flagDisplayLabel(flag.key);

  // Local state for string input to avoid re-saving on every keystroke
  const [localValue, setLocalValue] = useState(flag.value);
  const [localItems, setLocalItems] = useState<string[]>(() =>
    flagType === "string_list" ? parseStringList(flag.value) : [],
  );

  // Sync local state when flag prop changes (after successful save)
  useEffect(() => {
    setLocalValue(flag.value);
    if (flagType === "string_list") {
      setLocalItems(parseStringList(flag.value));
    }
  }, [flag.value, flagType]);

  function handleToggleEnabled(enabled: boolean) {
    onUpdate(flag.key, { enabled });
  }

  function handleStringSubmit() {
    if (localValue !== flag.value) {
      onUpdate(flag.key, { value: localValue });
    }
  }

  function handleStringKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleStringSubmit();
    }
  }

  function handleListChange(items: string[]) {
    setLocalItems(items);
    onUpdate(flag.key, { value: joinStringList(items) });
  }

  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlagTypeIcon flagType={flag.flag_type} />
            <CardTitle className="text-sm font-medium">
              {friendlyLabel ?? flag.description}
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-normal">
              {flagTypeLabel(flag.flag_type)}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            <ToggleSwitch
              checked={flag.enabled}
              onChange={handleToggleEnabled}
              disabled={saving}
              label={`Toggle ${flag.key}`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0 space-y-3">
        {/* Description + key */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {friendlyLabel ? flag.description : null}
            {friendlyLabel && " -- "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
              {flag.key}
            </code>
          </span>
          <span>Updated {timeAgo(flag.updated_at)}</span>
        </div>

        {/* Value editor based on flag type */}
        {flagType === "boolean" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Status:</span>
            <span className={flag.enabled ? "text-emerald-600 font-medium" : "text-muted-foreground"}>
              {flag.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        )}

        {(flagType === "string" || flagType === "number") && (
          <div className="flex gap-2">
            <Input
              type={flagType === "number" ? "number" : "text"}
              value={localValue}
              onChange={(e) => setLocalValue(e.target.value)}
              onBlur={handleStringSubmit}
              onKeyDown={handleStringKeyDown}
              disabled={saving}
              placeholder={flagType === "number" ? "Enter number..." : "Enter value..."}
              className="flex-1"
            />
            {localValue !== flag.value && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStringSubmit}
                disabled={saving}
              >
                Save
              </Button>
            )}
          </div>
        )}

        {flagType === "string_list" && (
          <TagEditor
            items={localItems}
            onChange={handleListChange}
            disabled={saving}
            placeholder={
              flag.key.includes("email") ? "Add email address..." : "Add item..."
            }
          />
        )}

        {/* Feedback message */}
        {feedback && (
          <div
            className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            {feedback.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function FeatureFlagSettings() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<SavingState>({});
  const [feedback, setFeedback] = useState<FeedbackState>({});

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feature-flags");
      if (!res.ok) {
        throw new Error(`Failed to load feature flags (${res.status})`);
      }
      const data: FeatureFlag[] = await res.json();
      setFlags(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function handleUpdate(
    key: string,
    updates: { value?: string; enabled?: boolean },
  ) {
    // Optimistic update
    const previousFlags = [...flags];
    setFlags((prev) =>
      prev.map((f) => {
        if (f.key !== key) return f;
        return {
          ...f,
          ...(updates.value !== undefined ? { value: updates.value } : {}),
          ...(updates.enabled !== undefined ? { enabled: updates.enabled } : {}),
          updated_at: new Date().toISOString(),
        };
      }),
    );

    setSaving((prev) => ({ ...prev, [key]: true }));
    // Clear previous feedback
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...updates }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(text);
      }

      setFeedback((prev) => ({
        ...prev,
        [key]: { type: "success", message: "Saved successfully" },
      }));
    } catch (err) {
      // Rollback on error
      setFlags(previousFlags);
      setFeedback((prev) => ({
        ...prev,
        [key]: {
          type: "error",
          message:
            err instanceof Error
              ? `Save failed: ${err.message}`
              : "Save failed",
        },
      }));
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));

      // Auto-clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }, 3000);
    }
  }

  // Error state
  if (error && !loading && flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">
            Unable to load feature flags
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchFlags();
          }}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <FlagCardSkeleton />
        <FlagCardSkeleton />
        <FlagCardSkeleton />
      </div>
    );
  }

  // Empty state
  if (flags.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
        <Settings className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">No feature flags</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No feature flags have been configured yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {flags.length} flag{flags.length !== 1 ? "s" : ""} configured
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLoading(true);
            fetchFlags();
          }}
          disabled={loading}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <div className="space-y-4">
        {flags.map((flag) => (
          <FlagCard
            key={flag.id}
            flag={flag}
            saving={!!saving[flag.key]}
            feedback={feedback[flag.key]}
            onUpdate={handleUpdate}
          />
        ))}
      </div>
    </div>
  );
}
