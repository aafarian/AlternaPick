import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError, badRequest } from "@/lib/api/errors";
import type { AdminUserRow, AdminUsersResponse } from "@/lib/admin/types";

/** Columns that live on the profiles table and can be sorted via Supabase. */
const PROFILE_SORT_COLUMNS = new Set([
  "username",
  "email",
  "created_at",
] as const);

/** Columns from leaderboard_entries that require JS-side sorting. */
const LEADERBOARD_SORT_COLUMNS = new Set([
  "total_cards",
  "win_rate",
  "last_active",
] as const);

type SortBy =
  | "username"
  | "email"
  | "created_at"
  | "total_cards"
  | "win_rate"
  | "last_active";
type SortOrder = "asc" | "desc";

const VALID_SORT_COLUMNS = new Set([
  ...PROFILE_SORT_COLUMNS,
  ...LEADERBOARD_SORT_COLUMNS,
]);

const MAX_PAGE_SIZE = 100;

/**
 * GET /api/admin/users
 * Returns a paginated, searchable, sortable list of users for the admin dashboard.
 *
 * Query params:
 *   page      - page number (default 1)
 *   pageSize  - rows per page (default 25, max 100)
 *   search    - substring filter on username or email (case-insensitive)
 *   sortBy    - column to sort by (default 'created_at')
 *   sortOrder - 'asc' | 'desc' (default 'desc')
 *
 * Returns 404 for non-admin users so the endpoint is not discoverable.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const { searchParams } = request.nextUrl;

    // Parse & validate query params
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") ?? "25", 10))
    );
    const search = searchParams.get("search")?.trim() || null;
    const sortBy = (searchParams.get("sortBy") ?? "created_at") as SortBy;
    const sortOrder = (searchParams.get("sortOrder") ?? "desc") as SortOrder;

    if (!VALID_SORT_COLUMNS.has(sortBy)) {
      return badRequest(
        `Invalid sortBy value. Must be one of: ${[...VALID_SORT_COLUMNS].join(", ")}`
      );
    }
    if (sortOrder !== "asc" && sortOrder !== "desc") {
      return badRequest("Invalid sortOrder value. Must be 'asc' or 'desc'.");
    }

    const supabase = createAdminClient();

    const isProfileSort = PROFILE_SORT_COLUMNS.has(
      sortBy as (typeof PROFILE_SORT_COLUMNS extends Set<infer T> ? T : never)
    );

    let users: AdminUserRow[];
    let total: number;

    if (isProfileSort) {
      // ---------------------------------------------------------------
      // Profile-column sort: Supabase handles ordering & pagination
      // ---------------------------------------------------------------
      const profileSelect =
        "id, username, email, display_name, avatar_url, is_deactivated, created_at";

      // Build count + data queries in parallel
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buildProfileQuery = (base: any) =>
        search
          ? base.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
          : base;

      const [countResult, dataResult] = await Promise.all([
        buildProfileQuery(
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
        ),
        buildProfileQuery(
          supabase.from("profiles").select(profileSelect)
        )
          .order(sortBy, { ascending: sortOrder === "asc" })
          .range(from, to),
      ]);

      total = countResult.count ?? 0;
      const profiles = (dataResult.data as ProfileRow[] | null) ?? [];

      // Fetch leaderboard entries for this page of profiles
      const profileIds = profiles.map((p) => p.id);
      const leaderboardMap = await fetchLeaderboardMap(supabase, profileIds);

      users = profiles.map((p) => mapToAdminUserRow(p, leaderboardMap));
    } else {
      // ---------------------------------------------------------------
      // Leaderboard-column sort: fetch all matching profiles + leaderboard,
      // merge, sort in JS, then paginate
      // ---------------------------------------------------------------
      const profileSelect =
        "id, username, email, display_name, avatar_url, is_deactivated, created_at";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let profileQuery: any = supabase.from("profiles").select(profileSelect);

      if (search) {
        profileQuery = profileQuery.or(
          `username.ilike.%${search}%,email.ilike.%${search}%`
        );
      }

      const profileResult = await profileQuery;
      const allProfiles = (profileResult.data as ProfileRow[] | null) ?? [];
      total = allProfiles.length;

      // Fetch all leaderboard entries for matched profiles
      const allIds = allProfiles.map((p) => p.id);
      const leaderboardMap = await fetchLeaderboardMap(supabase, allIds);

      // Merge and sort
      const merged = allProfiles.map((p) => ({
        row: mapToAdminUserRow(p, leaderboardMap),
        profile: p,
      }));

      merged.sort((a, b) => {
        let aVal: number | string | null;
        let bVal: number | string | null;

        switch (sortBy) {
          case "total_cards":
            aVal = a.row.totalCards;
            bVal = b.row.totalCards;
            break;
          case "win_rate":
            aVal = a.row.winRate;
            bVal = b.row.winRate;
            break;
          case "last_active":
            aVal = a.row.lastActive;
            bVal = b.row.lastActive;
            break;
          default:
            aVal = 0;
            bVal = 0;
        }

        // Null values sort to the end regardless of sort direction
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;

        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortOrder === "asc" ? cmp : -cmp;
      });

      // Paginate
      const from = (page - 1) * pageSize;
      users = merged.slice(from, from + pageSize).map((m) => m.row);
    }

    const response: AdminUsersResponse = {
      users,
      total,
      page,
      pageSize,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch admin users list");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ProfileRow = {
  id: string;
  username: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_deactivated: boolean;
  created_at: string;
};

type LeaderboardRow = {
  user_id: string;
  total_cards: number;
  win_rate: number;
  last_played_date: string | null;
};

/**
 * Fetch leaderboard entries for a set of profile IDs and return a lookup map.
 * Supabase `.in()` has a practical limit, so we batch in groups of 200.
 */
async function fetchLeaderboardMap(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  profileIds: string[]
): Promise<Map<string, LeaderboardRow>> {
  const map = new Map<string, LeaderboardRow>();
  if (profileIds.length === 0) return map;

  const BATCH_SIZE = 200;
  const batches: string[][] = [];
  for (let i = 0; i < profileIds.length; i += BATCH_SIZE) {
    batches.push(profileIds.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) =>
      supabase
        .from("leaderboard_entries")
        .select("user_id, total_cards, win_rate, last_played_date")
        .in("user_id", batch)
    )
  );

  for (const result of results) {
    const rows = (result.data as LeaderboardRow[] | null) ?? [];
    for (const row of rows) {
      map.set(row.user_id, row);
    }
  }

  return map;
}

/** Map a profile row + leaderboard data into an AdminUserRow. */
function mapToAdminUserRow(
  profile: ProfileRow,
  leaderboardMap: Map<string, LeaderboardRow>
): AdminUserRow {
  const lb = leaderboardMap.get(profile.id);
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    signupDate: profile.created_at,
    lastActive: lb?.last_played_date ?? null,
    totalCards: lb?.total_cards ?? 0,
    winRate: lb?.win_rate ?? 0,
    isDeactivated: profile.is_deactivated,
  };
}
