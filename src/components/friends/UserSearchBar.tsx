"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  friendship_status: "none" | "pending_sent" | "pending_received" | "friends";
}

interface UserSearchBarProps {
  onSendRequest: (username: string) => Promise<void>;
}

export default function UserSearchBar({ onSendRequest }: UserSearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.users ?? []);
        setIsOpen(true);
      }
    } catch {
      // Silently fail search
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  };

  const handleSendRequest = async (username: string) => {
    setSendingTo(username);
    try {
      await onSendRequest(username);
      // Update the local result to show pending
      setResults((prev) =>
        prev.map((r) =>
          r.username === username
            ? { ...r, friendship_status: "pending_sent" as const }
            : r
        )
      );
    } finally {
      setSendingTo(null);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getStatusButton = (user: SearchResult) => {
    switch (user.friendship_status) {
      case "friends":
        return (
          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted">
            Friends
          </span>
        );
      case "pending_sent":
        return (
          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted">
            Pending
          </span>
        );
      case "pending_received":
        return (
          <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted">
            Respond
          </span>
        );
      case "none":
      default:
        return (
          <button
            onClick={() => handleSendRequest(user.username)}
            disabled={sendingTo === user.username}
            className="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
          >
            {sendingTo === user.username ? "..." : "Add Friend"}
          </button>
        );
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          type="text"
          placeholder="Search users by username..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-foreground placeholder:text-muted focus:border-indigo-500 focus:outline-none"
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Dropdown results */}
      {isOpen && results.length > 0 && (
        <div className="absolute z-10 mt-2 w-full rounded-2xl border border-border bg-surface shadow-lg">
          {results.map((user) => {
            const initials = (user.display_name ?? user.username)
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={user.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-bold text-indigo-400">
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.username}
                      width={32}
                      height={32}
                      className="h-8 w-8 rounded-full object-cover"
                    />
                  ) : (
                    initials
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {user.display_name ?? user.username}
                  </p>
                  <p className="truncate text-xs text-muted">
                    @{user.username}
                  </p>
                </div>

                {/* Status button */}
                {getStatusButton(user)}
              </div>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {isOpen && results.length === 0 && query.length >= 2 && !searching && (
        <div className="absolute z-10 mt-2 w-full rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted shadow-lg">
          No users found matching &quot;{query}&quot;
        </div>
      )}
    </div>
  );
}
