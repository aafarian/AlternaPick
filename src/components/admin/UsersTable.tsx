"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Users,
} from "lucide-react";
import type { AdminUserRow, AdminUsersResponse } from "@/lib/admin/types";
import { formatDate, userInitials } from "@/lib/admin/helpers";

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

type SortBy =
  | "username"
  | "email"
  | "created_at"
  | "last_active"
  | "total_cards"
  | "win_rate";

interface ColumnDef {
  key: SortBy;
  label: string;
}

const columns: ColumnDef[] = [
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "created_at", label: "Signup Date" },
  { key: "last_active", label: "Last Active" },
  { key: "total_cards", label: "Cards" },
  { key: "win_rate", label: "Win Rate" },
];

// Status is not sortable, rendered separately
const PAGE_SIZE = 25;
const SKELETON_ROWS = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWinRate(rate: number): string {
  if (rate === 0) return "\u2014";
  return `${rate.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <TableRow>
      {/* Username */}
      <TableCell>
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </TableCell>
      {/* Email */}
      <TableCell>
        <Skeleton className="h-4 w-36" />
      </TableCell>
      {/* Signup Date */}
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      {/* Last Active */}
      <TableCell>
        <Skeleton className="h-4 w-24" />
      </TableCell>
      {/* Cards */}
      <TableCell>
        <Skeleton className="h-4 w-12" />
      </TableCell>
      {/* Win Rate */}
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      {/* Status */}
      <TableCell>
        <Skeleton className="h-5 w-16 rounded-full" />
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Sort header button
// ---------------------------------------------------------------------------

function SortableHeader({
  column,
  activeSortBy,
  activeSortOrder,
  onSort,
}: {
  column: ColumnDef;
  activeSortBy: SortBy;
  activeSortOrder: "asc" | "desc";
  onSort: (key: SortBy) => void;
}) {
  const isActive = activeSortBy === column.key;

  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors text-left"
      >
        {column.label}
        {isActive &&
          (activeSortOrder === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          ))}
      </button>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UsersTable() {
  const router = useRouter();

  // State
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("created_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [search]);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load users (${res.status})`);
      }
      const data: AdminUsersResponse = await res.json();
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Sort handler
  const handleSort = (key: SortBy) => {
    if (key === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
        <Users className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">Unable to load users</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={fetchUsers} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search users by username or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <SortableHeader
                  key={col.key}
                  column={col}
                  activeSortBy={sortBy}
                  activeSortOrder={sortOrder}
                  onSort={handleSort}
                />
              ))}
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <SkeletonRow key={i} />
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="h-32 text-center text-muted-foreground"
                >
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  onClick={() => router.push(`/admin/users/${user.id}`)}
                  className="cursor-pointer"
                >
                  {/* Username */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        {user.avatarUrl && (
                          <AvatarImage
                            src={user.avatarUrl}
                            alt={user.username}
                          />
                        )}
                        <AvatarFallback>
                          {userInitials(user.username)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">
                        {user.displayName
                          ? `${user.displayName} (${user.username})`
                          : user.username}
                      </span>
                    </div>
                  </TableCell>
                  {/* Email */}
                  <TableCell className="text-muted-foreground">
                    {user.email ?? "\u2014"}
                  </TableCell>
                  {/* Signup Date */}
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.signupDate)}
                  </TableCell>
                  {/* Last Active */}
                  <TableCell className="text-muted-foreground">
                    {formatDate(user.lastActive)}
                  </TableCell>
                  {/* Cards */}
                  <TableCell className="text-muted-foreground">
                    {user.totalCards.toLocaleString()}
                  </TableCell>
                  {/* Win Rate */}
                  <TableCell className="text-muted-foreground">
                    {formatWinRate(user.winRate)}
                  </TableCell>
                  {/* Status */}
                  <TableCell>
                    {user.isDeactivated ? (
                      <Badge variant="destructive">Deactivated</Badge>
                    ) : (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && users.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Showing {rangeStart}-{rangeEnd} of {total.toLocaleString()} users
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
