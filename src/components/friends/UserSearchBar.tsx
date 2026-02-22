"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import UserAvatar from "@/components/icons/UserAvatar";
import { parseIconConfig } from "@/lib/icons/parse";

interface SearchResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  icon_config: Record<string, unknown> | null;
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
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();

  const search = useCallback(async (q: string) => {
    // Cancel any in-flight request so stale responses don't overwrite newer ones
    abortRef.current?.abort();

    if (q.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(q)}`,
        { signal: controller.signal }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data.users ?? []);
        setIsOpen(true);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      if (!controller.signal.aborted) setSearching(false);
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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const getStatusButton = (user: SearchResult) => {
    switch (user.friendship_status) {
      case "friends":
        return <Badge variant="secondary">Friends</Badge>;
      case "pending_sent":
        return <Badge variant="secondary">Pending</Badge>;
      case "pending_received":
        return <Badge variant="secondary">Respond</Badge>;
      case "none":
      default:
        return (
          <Button
            onClick={() => handleSendRequest(user.username)}
            disabled={sendingTo === user.username}
            size="sm"
          >
            {sendingTo === user.username ? "..." : "Add Friend"}
          </Button>
        );
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search users by username..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          className="pl-9"
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            key="search-results"
            initial={prefersReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-10 mt-2 w-full rounded-xl border border-border bg-card shadow-lg"
          >
            {results.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={prefersReduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    prefersReduced
                      ? { duration: 0 }
                      : { delay: index * 0.05, duration: 0.25, ease: "easeOut" }
                  }
                  className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <UserAvatar
                    avatarUrl={user.avatar_url}
                    iconConfig={parseIconConfig(user.icon_config)}
                    userId={user.id}
                    username={user.username}
                    size={32}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {user.username}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      @{user.username}
                    </p>
                  </div>

                  {getStatusButton(user)}
                </motion.div>
            ))}
          </motion.div>
        )}

        {isOpen && results.length === 0 && query.length >= 2 && !searching && (
          <motion.div
            key="no-results"
            initial={prefersReduced ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-10 mt-2 w-full rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground shadow-lg"
          >
            No users found matching &quot;{query}&quot;
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
