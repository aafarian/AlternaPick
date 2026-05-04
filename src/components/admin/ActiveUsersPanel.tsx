"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { ActiveUsersData } from "@/lib/admin/types";

interface ActiveUsersPanelProps {
  data: ActiveUsersData;
}

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function ActiveUsersPanel({ data }: ActiveUsersPanelProps) {
  const [tab, setTab] = useState<"online" | "today">("online");

  const onlineUsers = data.activeToday.filter((u) => u.isOnline);
  const displayUsers = tab === "online" ? onlineUsers : data.activeToday;

  return (
    <div>
      <div className="mb-3 flex gap-1">
        <button
          type="button"
          onClick={() => setTab("online")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "online"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Online Now ({data.onlineCount})
        </button>
        <button
          type="button"
          onClick={() => setTab("today")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            tab === "today"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          Active Today ({data.activeToday.length})
        </button>
      </div>

      {displayUsers.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          {tab === "online" ? "No users online right now" : "No active users today"}
        </p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>User</TableHead>
                <TableHead className="text-right">Last Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="pr-0">
                    <div className="relative">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(user.username ?? "?")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {user.isOnline && (
                        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm font-medium">{user.username}</p>
                    {user.displayName && (
                      <p className="text-xs text-muted-foreground">
                        {user.displayName}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {timeAgo(user.lastActiveAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
