import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Friendship, Profile } from "@/lib/supabase/types";

export interface FriendWithProfile extends Friendship {
  friend_profile: Profile;
}

/**
 * Get all accepted friends for a user, with profile info.
 */
export async function getFriends(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<FriendWithProfile[]> {
  // Friendships where the user is the requester
  const { data: asRequester, error: err1 } = await (
    supabase.from("friendships") as any
  )
    .select("*, profiles!friendships_addressee_id_fkey(*)")
    .eq("requester_id", userId)
    .eq("status", "accepted");

  if (err1) throw new Error(err1.message);

  // Friendships where the user is the addressee
  const { data: asAddressee, error: err2 } = await (
    supabase.from("friendships") as any
  )
    .select("*, profiles!friendships_requester_id_fkey(*)")
    .eq("addressee_id", userId)
    .eq("status", "accepted");

  if (err2) throw new Error(err2.message);

  const friends: FriendWithProfile[] = [];

  for (const row of asRequester ?? []) {
    friends.push({
      ...(row as Friendship),
      friend_profile: row.profiles as Profile,
    });
  }

  for (const row of asAddressee ?? []) {
    friends.push({
      ...(row as Friendship),
      friend_profile: row.profiles as Profile,
    });
  }

  return friends;
}

/**
 * Get pending friend requests received by the user.
 */
export async function getPendingRequests(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<FriendWithProfile[]> {
  const { data, error } = await (supabase.from("friendships") as any)
    .select("*, profiles!friendships_requester_id_fkey(*)")
    .eq("addressee_id", userId)
    .eq("status", "pending");

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    ...(row as Friendship),
    friend_profile: row.profiles as Profile,
  }));
}

/**
 * Send a friend request. Validates: no self-friending, no duplicate in either direction.
 * Returns the created friendship row.
 */
export async function sendFriendRequest(
  supabase: SupabaseClient<Database>,
  requesterId: string,
  addresseeUsername: string
): Promise<Friendship> {
  // Look up addressee by username
  const { data: addressee, error: lookupError } = await (
    supabase.from("profiles") as any
  )
    .select("id, username")
    .eq("username", addresseeUsername)
    .single();

  if (lookupError || !addressee) {
    throw new NotFoundError("User not found");
  }

  const addresseeProfile = addressee as Profile;
  const addresseeId = addresseeProfile.id;

  // Cannot friend yourself
  if (requesterId === addresseeId) {
    throw new ValidationError("Cannot send a friend request to yourself");
  }

  // Check both directions for existing friendship
  const { data: existingAB, error: checkErr1 } = await (
    supabase.from("friendships") as any
  )
    .select("id, status")
    .eq("requester_id", requesterId)
    .eq("addressee_id", addresseeId)
    .maybeSingle();

  if (checkErr1) throw new Error(checkErr1.message);

  if (existingAB) {
    throw new ConflictError("A friendship already exists with this user");
  }

  const { data: existingBA, error: checkErr2 } = await (
    supabase.from("friendships") as any
  )
    .select("id, status")
    .eq("requester_id", addresseeId)
    .eq("addressee_id", requesterId)
    .maybeSingle();

  if (checkErr2) throw new Error(checkErr2.message);

  if (existingBA) {
    throw new ConflictError("A friendship already exists with this user");
  }

  // Create the friendship
  const { data: friendship, error: insertError } = await (
    supabase.from("friendships") as any
  )
    .insert({
      requester_id: requesterId,
      addressee_id: addresseeId,
      status: "pending",
    })
    .select()
    .single();

  if (insertError || !friendship) {
    throw new Error(insertError?.message ?? "Failed to create friend request");
  }

  return friendship as Friendship;
}

/**
 * Accept a friend request. Only the addressee can accept.
 */
export async function acceptFriendRequest(
  supabase: SupabaseClient<Database>,
  friendshipId: string,
  userId: string
): Promise<Friendship> {
  // Fetch the friendship
  const { data: friendship, error: fetchError } = await (
    supabase.from("friendships") as any
  )
    .select("*")
    .eq("id", friendshipId)
    .single();

  if (fetchError || !friendship) {
    throw new NotFoundError("Friendship not found");
  }

  const row = friendship as Friendship;

  if (row.addressee_id !== userId) {
    throw new ValidationError("Only the addressee can accept a friend request");
  }

  if (row.status !== "pending") {
    throw new ValidationError("This request is not pending");
  }

  const { data: updated, error: updateError } = await (
    supabase.from("friendships") as any
  )
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", friendshipId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Failed to accept friend request");
  }

  return updated as Friendship;
}

/**
 * Decline a friend request. Only the addressee can decline. Deletes the row.
 */
export async function declineFriendRequest(
  supabase: SupabaseClient<Database>,
  friendshipId: string,
  userId: string
): Promise<void> {
  // Fetch the friendship
  const { data: friendship, error: fetchError } = await (
    supabase.from("friendships") as any
  )
    .select("*")
    .eq("id", friendshipId)
    .single();

  if (fetchError || !friendship) {
    throw new NotFoundError("Friendship not found");
  }

  const row = friendship as Friendship;

  if (row.addressee_id !== userId) {
    throw new ValidationError(
      "Only the addressee can decline a friend request"
    );
  }

  if (row.status !== "pending") {
    throw new ValidationError("This request is not pending");
  }

  const { error: deleteError } = await (supabase.from("friendships") as any)
    .delete()
    .eq("id", friendshipId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

/**
 * Remove a friend (unfriend). Either party can delete.
 */
export async function removeFriend(
  supabase: SupabaseClient<Database>,
  friendshipId: string,
  userId: string
): Promise<void> {
  // Fetch the friendship to verify participation
  const { data: friendship, error: fetchError } = await (
    supabase.from("friendships") as any
  )
    .select("*")
    .eq("id", friendshipId)
    .single();

  if (fetchError || !friendship) {
    throw new NotFoundError("Friendship not found");
  }

  const row = friendship as Friendship;

  if (row.requester_id !== userId && row.addressee_id !== userId) {
    throw new NotFoundError("Friendship not found");
  }

  const { error: deleteError } = await (supabase.from("friendships") as any)
    .delete()
    .eq("id", friendshipId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

// Custom error classes for proper status code mapping
export class ValidationError extends Error {
  public status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  public status = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  public status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}
