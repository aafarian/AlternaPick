import type {
  AchievementCategory,
  AchievementTier,
  CardStatus,
  ChallengeStatus,
  GameMode,
  PickResult,
  PickSelection,
  StatCategory,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Activity Feed
// ---------------------------------------------------------------------------

export type AdminActivityEventType =
  | "user_signup"
  | "card_locked"
  | "card_resolved"
  | "challenge_created"
  | "challenge_accepted"
  | "challenge_resolved"
  | "challenge_declined"
  | "pick_made"
  | "achievement_unlocked"
  | "friend_request_sent"
  | "friend_accepted"
  | "reaction_added";

export interface AdminActivityItem {
  id: string;
  type: AdminActivityEventType;
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  description: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface AdminActivityFeedResponse {
  items: AdminActivityItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

export interface AdminUserRow {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  signupDate: string;
  lastActive: string | null;
  totalCards: number;
  winRate: number;
  isDeactivated: boolean;
}

export interface AdminUsersResponse {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// User Detail
// ---------------------------------------------------------------------------

export interface AdminUserDetail {
  profile: {
    id: string;
    username: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isDeactivated: boolean;
    signupDate: string;
    updatedAt: string;
  };
  stats: {
    totalCards: number;
    totalCorrectPicks: number;
    totalAttemptedPicks: number;
    winRate: number;
    currentStreak: number;
    bestStreak: number;
    dailyStreak: number;
    bestDailyStreak: number;
    h2hWins: number;
    h2hLosses: number;
    h2hWinPct: number;
  };
  recentCards: Array<{
    id: string;
    status: CardStatus;
    score: number;
    totalPicks: number;
    cardSize: number;
    gameMode: GameMode;
    lockedAt: string | null;
    resolvedAt: string | null;
    createdAt: string;
  }>;
  recentChallenges: Array<{
    id: string;
    opponentUsername: string;
    opponentDisplayName: string | null;
    status: string;
    gameMode: GameMode;
    winnerId: string | null;
    createdAt: string;
    resolvedAt: string | null;
  }>;
  achievements: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    tier: AchievementTier;
    category: AchievementCategory | null;
    unlockedAt: string;
  }>;
  friendCount: number;
}

// ---------------------------------------------------------------------------
// Helper constants
// ---------------------------------------------------------------------------

/** Label/value pairs for use in filter dropdowns */
export const ACTIVITY_EVENT_TYPES: {
  label: string;
  value: AdminActivityEventType;
}[] = [
  { label: "User Signup", value: "user_signup" },
  { label: "Card Locked", value: "card_locked" },
  { label: "Card Resolved", value: "card_resolved" },
  { label: "Challenge Created", value: "challenge_created" },
  { label: "Challenge Accepted", value: "challenge_accepted" },
  { label: "Challenge Resolved", value: "challenge_resolved" },
  { label: "Challenge Declined", value: "challenge_declined" },
  { label: "Pick Made", value: "pick_made" },
  { label: "Achievement Unlocked", value: "achievement_unlocked" },
  { label: "Friend Request Sent", value: "friend_request_sent" },
  { label: "Friend Accepted", value: "friend_accepted" },
  { label: "Reaction Added", value: "reaction_added" },
];

/** Badge color classes keyed by event type */
export const ACTIVITY_EVENT_COLORS: Record<AdminActivityEventType, string> = {
  user_signup: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  card_locked: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  card_resolved: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  challenge_created: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  challenge_accepted: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  challenge_resolved: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  challenge_declined: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  pick_made: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  achievement_unlocked: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  friend_request_sent: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  friend_accepted: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
  reaction_added: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

// ---------------------------------------------------------------------------
// Record Lookup
// ---------------------------------------------------------------------------

export interface AdminLookupResult {
  type: "profile" | "card" | "challenge" | "pick";
  id: string;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Card Detail (full card with all picks, prop details, results)
// ---------------------------------------------------------------------------

export interface AdminCardPickDetail {
  id: string;
  propId: string;
  playerName: string;
  playerTeam: string | null;
  statCategory: StatCategory;
  line: number;
  selection: PickSelection;
  result: PickResult;
  actualValue: number | null;
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
}

export interface AdminCardDetail {
  id: string;
  userId: string | null;
  username: string | null;
  displayName: string | null;
  status: CardStatus;
  score: number;
  totalPicks: number;
  cardSize: number;
  gameMode: GameMode;
  challengeId: string | null;
  lockedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  picks: AdminCardPickDetail[];
}

// ---------------------------------------------------------------------------
// Challenge Detail (full challenge with both players' cards, picks, props,
// results side-by-side)
// ---------------------------------------------------------------------------

export interface AdminChallengePlayerSide {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  card: AdminCardDetail | null;
}

export interface AdminChallengeDetail {
  id: string;
  status: ChallengeStatus;
  gameMode: GameMode;
  cardSize: number;
  message: string | null;
  winnerId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  challenger: AdminChallengePlayerSide;
  opponent: AdminChallengePlayerSide;
}

// ---------------------------------------------------------------------------
// System Health
// ---------------------------------------------------------------------------

export interface AdminSystemHealth {
  propSync: {
    lastSyncAt: string | null;
    totalProps: number;
    propsToday: number;
  };
  games: {
    scheduledToday: number;
    liveNow: number;
    finalToday: number;
    totalToday: number;
  };
  errors: {
    recentApiErrors: Array<{
      message: string;
      timestamp: string;
      endpoint: string | null;
    }>;
  };
}

// ---------------------------------------------------------------------------
// Moderation Actions
// ---------------------------------------------------------------------------

export type AdminModerationActionType =
  | "deactivate"
  | "reactivate"
  | "reset_password"
  | "delete_card"
  | "delete_challenge";

export interface AdminModerationAction {
  action: AdminModerationActionType;
  targetId: string;
}
