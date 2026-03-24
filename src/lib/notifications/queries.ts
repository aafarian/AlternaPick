import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  Notification,
  NotificationPreferences,
  NotificationType,
} from "@/lib/supabase/types";
import { typedFrom } from "@/lib/supabase/typed-queries";

export interface UnreadCounts {
  pendingFriendRequests: number;
  pendingChallenges: number;
  unreadNotifications: number;
}

/**
 * Get unread notification counts for a user.
 * - pendingFriendRequests: friendships where addressee_id = userId AND status = 'pending'
 * - pendingChallenges: challenges where opponent_id = userId AND status = 'pending'
 * - unreadNotifications: notifications where user_id = userId AND read = false
 */
export async function getUnreadCounts(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<UnreadCounts> {
  // Count pending friend requests received by the user
  const { count: friendCount, error: friendError } = await typedFrom(
    supabase,
    "friendships"
  )
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (friendError) {
    throw new Error(
      `Failed to count pending friend requests: ${friendError.message}`
    );
  }

  // Count pending 1v1 challenges received by the user
  const { count: oneVOneCount, error: challengeError } = await typedFrom(
    supabase,
    "challenges"
  )
    .select("id", { count: "exact", head: true })
    .eq("opponent_id", userId)
    .eq("status", "pending");

  if (challengeError) {
    throw new Error(
      `Failed to count pending challenges: ${challengeError.message}`
    );
  }

  // Count group challenge invites where user is still "invited"
  const { count: groupInviteCount, error: groupError } = await (
    supabase.from("challenge_participants") as any
  )
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "invited");

  if (groupError) {
    throw new Error(
      `Failed to count group challenge invites: ${(groupError as Error).message}`
    );
  }

  const challengeCount = (oneVOneCount ?? 0) + (groupInviteCount ?? 0);

  // Count unread notifications
  const { count: notifCount, error: notifError } = await typedFrom(
    supabase,
    "notifications"
  )
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (notifError) {
    throw new Error(
      `Failed to count unread notifications: ${notifError.message}`
    );
  }

  return {
    pendingFriendRequests: friendCount ?? 0,
    pendingChallenges: challengeCount ?? 0,
    unreadNotifications: notifCount ?? 0,
  };
}

/**
 * Get paginated notifications for a user, ordered by newest first.
 */
export async function getNotifications(
  supabase: SupabaseClient<Database>,
  userId: string,
  limit = 20,
  offset = 0
): Promise<Notification[]> {
  const { data, error } = await typedFrom(supabase, "notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch notifications: ${error.message}`);
  }

  return (data ?? []) as Notification[];
}

/**
 * Mark a single notification as read for a user.
 * Returns the updated notification or null if not found.
 */
export async function markNotificationRead(
  supabase: SupabaseClient<Database>,
  userId: string,
  notificationId: string
): Promise<Notification | null> {
  const { data, error } = await typedFrom(supabase, "notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }

  return (data as Notification) ?? null;
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllRead(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<void> {
  const { error } = await typedFrom(supabase, "notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) {
    throw new Error(
      `Failed to mark all notifications as read: ${error.message}`
    );
  }
}

/**
 * Create a new notification. Typically called server-side with the admin client.
 *
 * If `preferences` is provided and the user has explicitly disabled this
 * notification type (`preferences[type] === false`), the insert is skipped
 * and `null` is returned. When preferences is `null`/`undefined` or the key
 * is missing, the notification is created normally (default-on for backwards
 * compatibility).
 */
export async function createNotification(
  supabase: SupabaseClient<Database>,
  notification: {
    user_id: string;
    type: NotificationType;
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
  },
  preferences?: NotificationPreferences | null
): Promise<Notification | null> {
  // If preferences were provided and this type is explicitly disabled, skip
  if (preferences && preferences[notification.type] === false) {
    return null;
  }

  const { data, error } = await typedFrom(supabase, "notifications")
    .insert({
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      metadata: notification.metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create notification: ${error.message}`);
  }

  return data as Notification;
}
