import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleApiError } from "@/lib/api/errors";
import { logWarn } from "@/lib/logger";
import type {
  AdminDetailedOverview,
  SignupTrendPoint,
  EngagementMetrics,
  ActiveUsersData,
  ActiveUser,
  HourlyActivity,
  TokenEconomyStats,
} from "@/lib/admin/types";

const ADMIN_TIMEZONE = "America/New_York";
const ROW_LIMIT = 50000;

// Reuse the same timezone-aware date helper from the main overview route.
function startOfDayInTimezone(now: Date, timeZone: string, dayOffset = 0): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);

  const offsetFmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const offsetPart = offsetFmt
    .formatToParts(now)
    .find((p) => p.type === "timeZoneName")?.value;
  let offsetMinutes = 0;
  if (offsetPart && offsetPart.startsWith("GMT")) {
    const sign = offsetPart[3] === "-" ? -1 : 1;
    const rest = offsetPart.slice(4);
    if (rest) {
      const [hh, mm] = rest.split(":").map(Number);
      offsetMinutes = sign * (hh * 60 + (mm ?? 0));
    }
  }

  const localMidnightAsUtc = Date.UTC(y, m - 1, d + dayOffset, 0, 0, 0, 0);
  const utcInstant = localMidnightAsUtc - offsetMinutes * 60 * 1000;
  return new Date(utcInstant).toISOString();
}

function dateInTimezone(isoString: string, timeZone: string): string {
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value;
  const mo = parts.find((p) => p.type === "month")?.value;
  const dd = parts.find((p) => p.type === "day")?.value;
  return `${y}-${mo}-${dd}`;
}

function hourInTimezone(isoString: string, timeZone: string): number {
  const d = new Date(isoString);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  });
  return Number(fmt.format(d));
}

function warnIfLimitHit(label: string, rows: unknown[] | null, limit: number) {
  if (rows && rows.length >= limit) {
    logWarn("admin-detailed", `${label} hit ${limit} row limit — data may be incomplete`);
  }
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

async function buildSignupTrend(
  supabase: ReturnType<typeof createAdminClient>,
  now: Date,
  thirtyDaysAgo: string,
): Promise<SignupTrendPoint[]> {
  const { data, error } = await (supabase.from("profiles") as any)
    .select("created_at")
    .gte("created_at", thirtyDaysAgo)
    .limit(ROW_LIMIT);

  if (error) throw new Error(`Signup trend: ${error.message}`);
  warnIfLimitHit("Signup trend", data, ROW_LIMIT);

  const buckets = new Map<string, number>();
  for (const row of (data ?? []) as { created_at: string }[]) {
    const day = dateInTimezone(row.created_at, ADMIN_TIMEZONE);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }

  const result: SignupTrendPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = dateInTimezone(
      startOfDayInTimezone(now, ADMIN_TIMEZONE, -i),
      ADMIN_TIMEZONE,
    );
    result.push({ date: day, signups: buckets.get(day) ?? 0 });
  }
  return result;
}

async function buildEngagement(
  supabase: ReturnType<typeof createAdminClient>,
  now: Date,
  todayStart: string,
): Promise<EngagementMetrics> {
  const day7Ago = startOfDayInTimezone(now, ADMIN_TIMEZONE, -7);
  const day8Ago = startOfDayInTimezone(now, ADMIN_TIMEZONE, -8);
  const day30Ago = startOfDayInTimezone(now, ADMIN_TIMEZONE, -30);

  const [cohort, retained, mau, dau, cardsToday, picksToday, dauTrendRows] =
    await Promise.all([
      (supabase.from("profiles") as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", day8Ago)
        .lt("created_at", day7Ago)
        .eq("is_deactivated", false),
      (supabase.from("profiles") as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", day8Ago)
        .lt("created_at", day7Ago)
        .gte("last_active_at", day7Ago)
        .eq("is_deactivated", false),
      (supabase.from("profiles") as any)
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", day30Ago)
        .eq("is_deactivated", false),
      (supabase.from("profiles") as any)
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", todayStart)
        .eq("is_deactivated", false),
      (supabase.from("cards") as any)
        .select("*", { count: "exact", head: true })
        .gte("locked_at", todayStart),
      (supabase.from("picks") as any)
        .select("*", { count: "exact", head: true })
        .gte("created_at", todayStart),
      (supabase.from("profiles") as any)
        .select("last_active_at")
        .gte("last_active_at", startOfDayInTimezone(now, ADMIN_TIMEZONE, -14))
        .eq("is_deactivated", false)
        .not("last_active_at", "is", null)
        .limit(ROW_LIMIT),
    ]);

  const cohortSize = cohort.count ?? 0;
  const retainedCount = retained.count ?? 0;
  const mauCount = mau.count ?? 0;
  const dauCount = dau.count ?? 0;
  const cardsTodayCount = cardsToday.count ?? 0;
  const picksTodayCount = picksToday.count ?? 0;

  // DAU trend: bucket profiles by date of last_active_at
  const dauBuckets = new Map<string, number>();
  for (const row of (dauTrendRows.data ?? []) as { last_active_at: string }[]) {
    const day = dateInTimezone(row.last_active_at, ADMIN_TIMEZONE);
    dauBuckets.set(day, (dauBuckets.get(day) ?? 0) + 1);
  }
  const dauTrend: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = dateInTimezone(
      startOfDayInTimezone(now, ADMIN_TIMEZONE, -i),
      ADMIN_TIMEZONE,
    );
    dauTrend.push({ date: day, count: dauBuckets.get(day) ?? 0 });
  }

  return {
    day7Retention: cohortSize > 0
      ? Math.round((retainedCount / cohortSize) * 1000) / 10
      : 0,
    day7RetentionCohortSize: cohortSize,
    avgCardsPerActiveUser: dauCount > 0
      ? Math.round((cardsTodayCount / dauCount) * 10) / 10
      : 0,
    avgPicksPerActiveUser: dauCount > 0
      ? Math.round((picksTodayCount / dauCount) * 10) / 10
      : 0,
    dauMauRatio: mauCount > 0
      ? Math.round((dauCount / mauCount) * 1000) / 10
      : 0,
    dauTrend,
  };
}

async function buildActiveUsers(
  supabase: ReturnType<typeof createAdminClient>,
  now: Date,
  todayStart: string,
): Promise<ActiveUsersData> {
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();

  const [onlineResult, activeTodayResult] = await Promise.all([
    (supabase.from("profiles") as any)
      .select("*", { count: "exact", head: true })
      .gte("last_active_at", fifteenMinAgo)
      .eq("is_deactivated", false),
    (supabase.from("profiles") as any)
      .select("id, username, display_name, avatar_url, last_active_at")
      .gte("last_active_at", todayStart)
      .eq("is_deactivated", false)
      .order("last_active_at", { ascending: false })
      .limit(100),
  ]);

  const onlineCount = onlineResult.count ?? 0;
  const rows = (activeTodayResult.data ?? []) as Array<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    last_active_at: string;
  }>;

  const fifteenMinAgoMs = new Date(fifteenMinAgo).getTime();
  const activeToday: ActiveUser[] = rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    lastActiveAt: row.last_active_at,
    isOnline: new Date(row.last_active_at).getTime() >= fifteenMinAgoMs,
  }));

  return { onlineCount, activeToday };
}

async function buildHourlyActivity(
  supabase: ReturnType<typeof createAdminClient>,
  todayStart: string,
): Promise<HourlyActivity[]> {
  const [cardsRes, picksRes, signupsRes] = await Promise.all([
    (supabase.from("cards") as any)
      .select("locked_at")
      .gte("locked_at", todayStart)
      .limit(10000),
    (supabase.from("picks") as any)
      .select("created_at")
      .gte("created_at", todayStart)
      .limit(10000),
    (supabase.from("profiles") as any)
      .select("created_at")
      .gte("created_at", todayStart)
      .limit(10000),
  ]);

  const hours: HourlyActivity[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    cards: 0,
    picks: 0,
    signups: 0,
  }));

  for (const r of (cardsRes.data ?? []) as { locked_at: string }[]) {
    hours[hourInTimezone(r.locked_at, ADMIN_TIMEZONE)].cards++;
  }
  for (const r of (picksRes.data ?? []) as { created_at: string }[]) {
    hours[hourInTimezone(r.created_at, ADMIN_TIMEZONE)].picks++;
  }
  for (const r of (signupsRes.data ?? []) as { created_at: string }[]) {
    hours[hourInTimezone(r.created_at, ADMIN_TIMEZONE)].signups++;
  }

  return hours;
}

async function buildTokenEconomy(
  supabase: ReturnType<typeof createAdminClient>,
  todayStart: string,
): Promise<TokenEconomyStats> {
  const [wagerRes, circulatingRes] = await Promise.all([
    (supabase.from("cards") as any)
      .select("fire_token_wager, fire_token_payout, user_id")
      .gte("locked_at", todayStart)
      .not("fire_token_wager", "is", null)
      .limit(10000),
    (supabase.from("leaderboard_entries") as any)
      .select("fire_tokens_balance")
      .limit(ROW_LIMIT),
  ]);

  const wagerCards = (wagerRes.data ?? []) as Array<{
    fire_token_wager: number;
    fire_token_payout: number | null;
    user_id: string;
  }>;

  let totalWagered = 0;
  let totalPayouts = 0;
  const wagererMap = new Map<string, number>();

  for (const card of wagerCards) {
    totalWagered += card.fire_token_wager;
    totalPayouts += card.fire_token_payout ?? 0;
    wagererMap.set(
      card.user_id,
      (wagererMap.get(card.user_id) ?? 0) + card.fire_token_wager,
    );
  }

  const topEntries = [...wagererMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let topWagerers: { username: string; wageredToday: number }[] = [];
  if (topEntries.length > 0) {
    const userIds = topEntries.map(([id]) => id);
    const { data: profiles } = await (supabase.from("profiles") as any)
      .select("id, username")
      .in("id", userIds);

    const usernameMap = new Map<string, string>();
    for (const p of (profiles ?? []) as { id: string; username: string }[]) {
      usernameMap.set(p.id, p.username);
    }
    topWagerers = topEntries.map(([id, amount]) => ({
      username: usernameMap.get(id) ?? "unknown",
      wageredToday: amount,
    }));
  }

  const circulatingRows = (circulatingRes.data ?? []) as {
    fire_tokens_balance: number;
  }[];
  const totalCirculating = circulatingRows.reduce(
    (sum, r) => sum + (r.fire_tokens_balance ?? 0),
    0,
  );

  return {
    totalWageredToday: totalWagered,
    totalPayoutsToday: totalPayouts,
    netTokenFlow: totalWagered - totalPayouts,
    avgWagerSize:
      wagerCards.length > 0
        ? Math.round(totalWagered / wagerCards.length)
        : 0,
    totalCirculatingTokens: totalCirculating,
    topWagerers,
  };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/overview/detailed
 * Returns rich analytics data for the admin dashboard: signup trends,
 * engagement metrics, active users, hourly activity, and token economy.
 */
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.isAdmin) {
      return auth.response;
    }

    const supabase = createAdminClient();
    const now = new Date();
    const todayStart = startOfDayInTimezone(now, ADMIN_TIMEZONE);
    const thirtyDaysAgo = startOfDayInTimezone(now, ADMIN_TIMEZONE, -30);

    const [signupTrend, engagement, activeUsers, hourlyActivity, tokenEconomy] =
      await Promise.all([
        buildSignupTrend(supabase, now, thirtyDaysAgo),
        buildEngagement(supabase, now, todayStart),
        buildActiveUsers(supabase, now, todayStart),
        buildHourlyActivity(supabase, todayStart),
        buildTokenEconomy(supabase, todayStart),
      ]);

    const response: AdminDetailedOverview = {
      signupTrend,
      engagement,
      activeUsers,
      hourlyActivity,
      tokenEconomy,
    };

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch detailed overview");
  }
}
