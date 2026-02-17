"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export default function PlayerSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPlayer = searchParams.get("player") ?? "";
  const [value, setValue] = useState(currentPlayer);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last value we pushed so we can distinguish our own URL updates
  // from external navigation (back/forward) and only sync on the latter.
  const lastPushedRef = useRef(currentPlayer);

  useEffect(() => {
    if (currentPlayer !== lastPushedRef.current) {
      setValue(currentPlayer);
    }
    lastPushedRef.current = currentPlayer;
  }, [currentPlayer]);

  // Clean up debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const pushSearch = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      lastPushedRef.current = trimmed;
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("player", trimmed);
      } else {
        params.delete("player");
      }
      const qs = params.toString();
      router.push(qs ? `/props?${qs}` : "/props");
    },
    [router, searchParams]
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setValue(next);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushSearch(next);
    }, 300);
  }

  function handleClear() {
    setValue("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushSearch("");
  }

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search players or teams..."
        value={value}
        onChange={handleChange}
        className="pl-9 pr-9"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
