/**
 * Types for the referral system.
 *
 * Referral links use the format /join/[username].
 * When a new user signs up via a referral link, the referrer receives
 * a streak freeze and an automatic accepted friendship with the referee.
 */

export interface ReferralInfo {
  /** The referral link path, e.g. "/join/kingJames" */
  referralLink: string;
  /** Total number of users this user has referred */
  totalReferred: number;
  /** Total rewards earned (streak freezes granted via referrals) */
  rewardsEarned: number;
}

export interface ReferredUser {
  username: string;
  created_at: string;
}

export interface ReferralStats {
  /** Total number of users referred */
  totalReferred: number;
  /** List of referred users with their details */
  referredUsers: ReferredUser[];
}
