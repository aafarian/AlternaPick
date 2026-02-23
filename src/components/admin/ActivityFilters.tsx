"use client";

import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ACTIVITY_EVENT_TYPES } from "@/lib/admin/types";
import { X } from "lucide-react";

export interface ActivityFilterValues {
  type?: string;
  userSearch?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface ActivityFiltersProps {
  filters: ActivityFilterValues;
  onFiltersChange: (filters: ActivityFilterValues) => void;
}

export default function ActivityFilters({
  filters,
  onFiltersChange,
}: ActivityFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.userSearch ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync external filter changes back to the local input
  useEffect(() => {
    setSearchInput(filters.userSearch ?? "");
  }, [filters.userSearch]);

  function handleSearchChange(value: string) {
    setSearchInput(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, userSearch: value || undefined });
    }, 300);
  }

  function handleTypeChange(value: string) {
    onFiltersChange({
      ...filters,
      type: value === "all" ? undefined : value,
    });
  }

  function handleDateFromChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      dateFrom: val || undefined,
    });
  }

  function handleDateToChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onFiltersChange({
      ...filters,
      dateTo: val || undefined,
    });
  }

  const hasActiveFilters = !!(
    filters.type ||
    filters.userSearch ||
    filters.dateFrom ||
    filters.dateTo
  );

  function clearFilters() {
    setSearchInput("");
    onFiltersChange({});
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Event type filter */}
      <Select
        value={filters.type ?? "all"}
        onValueChange={handleTypeChange}
      >
        <SelectTrigger className="w-[180px]" size="sm">
          <SelectValue placeholder="All Events" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Events</SelectItem>
          {ACTIVITY_EVENT_TYPES.map((evt) => (
            <SelectItem key={evt.value} value={evt.value}>
              {evt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Username search */}
      <Input
        placeholder="Filter by username..."
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="h-8 w-[200px]"
      />

      {/* Date from */}
      <input
        type="date"
        value={filters.dateFrom ?? ""}
        onChange={handleDateFromChange}
        className="h-8 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none dark:bg-input/30"
        aria-label="From date"
      />

      {/* Date to */}
      <input
        type="date"
        value={filters.dateTo ?? ""}
        onChange={handleDateToChange}
        className="h-8 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none dark:bg-input/30"
        aria-label="To date"
      />

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Clear Filters
        </Button>
      )}
    </div>
  );
}
