export type StatCategory =
  | "points"
  | "rebounds"
  | "assists"
  | "threes"
  | "blocks"
  | "steals"
  | "turnovers"
  | "pra"
  | "pts_reb"
  | "pts_ast"
  | "reb_ast"
  | "blk_stl"
  | "shots"
  | "shots_on_target"
  | "tackles"
  | "passes"
  | "goals"
  | "fouls_committed"
  | "saves";

export type GameStatus =
  | "scheduled"
  | "live"
  | "final"
  | "postponed"
  | "cancelled";

export type CardStatus = "draft" | "locked" | "resolved";

export type PickSelection = "over" | "under";

export type PickResult = "pending" | "hit" | "miss" | "push" | "dnp";

export type ChallengeStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "declined"
  | "active"
  | "resolved"
  | "cancelled";

export type FriendshipStatus = "pending" | "accepted" | "blocked";

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "challenge_received"
  | "challenge_accepted"
  | "challenge_resolved"
  | "card_resolved"
  | "achievement_unlocked"
  | "reaction_received"
  | "daily_recap";

export type EmailNotificationType =
  | "email_card_resolved"
  | "email_challenge_received"
  | "email_challenge_resolved"
  | "email_friend_request";

export const EMAIL_NOTIFICATION_TYPES: EmailNotificationType[] = [
  "email_card_resolved",
  "email_challenge_received",
  "email_challenge_resolved",
  "email_friend_request",
];

export type NotificationPreferences = Record<
  NotificationType | EmailNotificationType,
  boolean
>;

export const NOTIFICATION_TYPE_TO_EMAIL_KEY: Partial<
  Record<NotificationType, keyof NotificationPreferences>
> = {
  card_resolved: "email_card_resolved",
  challenge_received: "email_challenge_received",
  challenge_resolved: "email_challenge_resolved",
  friend_request: "email_friend_request",
};

export type AchievementTier = "standard" | "gold" | "legendary";

export type AchievementCategory =
  | "cards"
  | "streaks"
  | "accuracy"
  | "social"
  | "special";

export type GameMode =
  | "classic"
  | "sabotage"
  | "mirror"
  | "random"
  | "one_player"
  | "one_team";

export type ReactionEmoji = "fire" | "skull" | "crying" | "clown" | "goat";

export type ReactionTargetType = "challenge" | "card";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          notification_preferences: NotificationPreferences | null;
          is_deactivated: boolean;
          onboarding_completed: boolean;
          streak_freezes_available: number;
          last_streak_freeze_reset: string | null;
          referred_by: string | null;
          icon_config: Record<string, unknown> | null;
          is_admin: boolean;
          email: string | null;
          username_chosen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          notification_preferences?: NotificationPreferences | null;
          is_deactivated?: boolean;
          onboarding_completed?: boolean;
          streak_freezes_available?: number;
          last_streak_freeze_reset?: string | null;
          referred_by?: string | null;
          icon_config?: Record<string, unknown> | null;
          is_admin?: boolean;
          email?: string | null;
          username_chosen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          notification_preferences?: NotificationPreferences | null;
          is_deactivated?: boolean;
          onboarding_completed?: boolean;
          streak_freezes_available?: number;
          last_streak_freeze_reset?: string | null;
          referred_by?: string | null;
          icon_config?: Record<string, unknown> | null;
          is_admin?: boolean;
          email?: string | null;
          username_chosen_at?: string | null;
          updated_at?: string;
        };
      };
      games: {
        Row: {
          id: string;
          odds_api_event_id: string;
          home_team: string;
          away_team: string;
          commence_time: string;
          status: GameStatus;
          home_score: number;
          away_score: number;
          external_event_id: string | null;
          sport: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          odds_api_event_id: string;
          home_team: string;
          away_team: string;
          commence_time: string;
          status?: GameStatus;
          home_score?: number;
          away_score?: number;
          external_event_id?: string | null;
          sport?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          odds_api_event_id?: string;
          home_team?: string;
          away_team?: string;
          commence_time?: string;
          status?: GameStatus;
          home_score?: number;
          away_score?: number;
          external_event_id?: string | null;
          sport?: string;
          updated_at?: string;
        };
      };
      props: {
        Row: {
          id: string;
          game_id: string;
          player_name: string;
          player_id: string | null;
          player_team: string | null;
          player_position: string | null;
          stat_category: StatCategory;
          line: number;
          over_odds: number | null;
          under_odds: number | null;
          bookmaker: string | null;
          fetched_at: string;
          created_at: string;
          line_history: Array<{ t: string; l: number }> | null;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_name: string;
          player_id?: string | null;
          player_team?: string | null;
          player_position?: string | null;
          stat_category: StatCategory;
          line: number;
          over_odds?: number | null;
          under_odds?: number | null;
          bookmaker?: string | null;
          fetched_at?: string;
          created_at?: string;
          line_history?: Array<{ t: string; l: number }> | null;
        };
        Update: {
          game_id?: string;
          player_name?: string;
          player_id?: string | null;
          player_team?: string | null;
          player_position?: string | null;
          stat_category?: StatCategory;
          line?: number;
          over_odds?: number | null;
          under_odds?: number | null;
          bookmaker?: string | null;
          fetched_at?: string;
          line_history?: Array<{ t: string; l: number }> | null;
        };
      };
      cards: {
        Row: {
          id: string;
          user_id: string | null;
          anon_id: string | null;
          challenge_id: string | null;
          status: CardStatus;
          score: number;
          total_picks: number;
          card_size: number;
          game_mode: GameMode;
          locked_at: string | null;
          resolved_at: string | null;
          share_token: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          anon_id?: string | null;
          challenge_id?: string | null;
          status?: CardStatus;
          score?: number;
          total_picks?: number;
          card_size?: number;
          game_mode?: GameMode;
          locked_at?: string | null;
          share_token?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string | null;
          anon_id?: string | null;
          challenge_id?: string | null;
          status?: CardStatus;
          score?: number;
          total_picks?: number;
          card_size?: number;
          game_mode?: GameMode;
          locked_at?: string | null;
          resolved_at?: string | null;
          share_token?: string | null;
        };
      };
      picks: {
        Row: {
          id: string;
          card_id: string;
          prop_id: string;
          selection: PickSelection;
          result: PickResult;
          actual_value: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          card_id: string;
          prop_id: string;
          selection: PickSelection;
          result?: PickResult;
          actual_value?: number | null;
          created_at?: string;
        };
        Update: {
          card_id?: string;
          prop_id?: string;
          selection?: PickSelection;
          result?: PickResult;
          actual_value?: number | null;
        };
      };
      challenges: {
        Row: {
          id: string;
          challenger_id: string;
          opponent_id: string | null;
          opponent_email: string | null;
          status: ChallengeStatus;
          game_mode: GameMode;
          message: string | null;
          mirror_props: string[] | null;
          card_size: number;
          winner_id: string | null;
          lobby_type: string;
          max_participants: number;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          challenger_id: string;
          opponent_id?: string | null;
          opponent_email?: string | null;
          status?: ChallengeStatus;
          game_mode?: GameMode;
          message?: string | null;
          mirror_props?: string[] | null;
          card_size?: number;
          winner_id?: string | null;
          lobby_type?: string;
          max_participants?: number;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          challenger_id?: string;
          opponent_id?: string | null;
          opponent_email?: string | null;
          status?: ChallengeStatus;
          game_mode?: GameMode;
          message?: string | null;
          mirror_props?: string[] | null;
          card_size?: number;
          winner_id?: string | null;
          lobby_type?: string;
          max_participants?: number;
          resolved_at?: string | null;
        };
      };
      feature_flags: {
        Row: {
          id: string;
          key: string;
          value: string;
          flag_type: string;
          description: string;
          enabled: boolean;
          env_var_fallback: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: string;
          flag_type?: string;
          description?: string;
          enabled?: boolean;
          env_var_fallback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          flag_type?: string;
          description?: string;
          enabled?: boolean;
          env_var_fallback?: string | null;
          updated_at?: string;
        };
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: FriendshipStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status?: FriendshipStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          requester_id?: string;
          addressee_id?: string;
          status?: FriendshipStatus;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          metadata: Record<string, unknown> | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          metadata?: Record<string, unknown> | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string;
          metadata?: Record<string, unknown> | null;
          read?: boolean;
        };
      };
      achievements: {
        Row: {
          id: string;
          key: string;
          name: string;
          description: string;
          icon: string;
          tier: AchievementTier;
          category: AchievementCategory | null;
          threshold: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          name: string;
          description: string;
          icon: string;
          tier?: AchievementTier;
          category?: AchievementCategory | null;
          threshold?: number | null;
          created_at?: string;
        };
        Update: {
          key?: string;
          name?: string;
          description?: string;
          icon?: string;
          tier?: AchievementTier;
          category?: AchievementCategory | null;
          threshold?: number | null;
        };
      };
      user_achievements: {
        Row: {
          id: string;
          user_id: string;
          achievement_id: string;
          unlocked_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          achievement_id: string;
          unlocked_at?: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          achievement_id?: string;
          unlocked_at?: string;
        };
      };
      reactions: {
        Row: {
          id: string;
          user_id: string;
          target_type: ReactionTargetType;
          target_id: string;
          emoji: ReactionEmoji;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: ReactionTargetType;
          target_id: string;
          emoji: ReactionEmoji;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          target_type?: ReactionTargetType;
          target_id?: string;
          emoji?: ReactionEmoji;
        };
      };
      leaderboard_entries: {
        Row: {
          id: string;
          user_id: string;
          total_cards: number;
          total_correct_picks: number;
          total_attempted_picks: number;
          win_rate: number;
          current_streak: number;
          best_streak: number;
          daily_streak: number;
          best_daily_streak: number;
          last_played_date: string | null;
          h2h_wins: number;
          h2h_losses: number;
          h2h_win_pct: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_cards?: number;
          total_correct_picks?: number;
          total_attempted_picks?: number;
          win_rate?: number;
          current_streak?: number;
          best_streak?: number;
          daily_streak?: number;
          best_daily_streak?: number;
          last_played_date?: string | null;
          h2h_wins?: number;
          h2h_losses?: number;
          updated_at?: string;
        };
        Update: {
          total_cards?: number;
          total_correct_picks?: number;
          total_attempted_picks?: number;
          win_rate?: number;
          current_streak?: number;
          best_streak?: number;
          daily_streak?: number;
          best_daily_streak?: number;
          last_played_date?: string | null;
          h2h_wins?: number;
          h2h_losses?: number;
          updated_at?: string;
        };
      };
      /**
       * Daily recap summaries computed from resolved cards/picks.
       *
       * recap_data (jsonb): {
       *   trapProps, lockProps, playerSpotlightsGood, playerSpotlightsBad,
       *   mostPickedPlayers, mostPickedProps, perfectCards,
       *   statCategoryBreakdown, sportBreakdown, platformHitRate,
       *   totalPicks, totalCards
       * }
       *
       * personal_highlights (jsonb): maps user_id to {
       *   cardsPlayed, hitRate, bestPick, worstPick,
       *   platformAvgHitRate, featuredIn
       * }
       */
      recaps: {
        Row: {
          id: string;
          recap_date: string;
          recap_data: Record<string, unknown>;
          personal_highlights: Record<string, unknown>;
          weekly_data: Record<string, unknown> | null;
          computed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          recap_date: string;
          recap_data: Record<string, unknown>;
          personal_highlights?: Record<string, unknown>;
          weekly_data?: Record<string, unknown> | null;
          computed_at?: string;
          created_at?: string;
        };
        Update: {
          recap_date?: string;
          recap_data?: Record<string, unknown>;
          personal_highlights?: Record<string, unknown>;
          weekly_data?: Record<string, unknown> | null;
          computed_at?: string;
        };
      };
      email_events: {
        Row: {
          id: string;
          event_type: string;
          email_to: string;
          email_subject: string | null;
          resend_email_id: string;
          payload: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_type: string;
          email_to: string;
          email_subject?: string | null;
          resend_email_id: string;
          payload?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          event_type?: string;
          email_to?: string;
          email_subject?: string | null;
          resend_email_id?: string;
          payload?: Record<string, unknown>;
        };
      };
      guest_tokens: {
        Row: {
          id: string;
          token: string;
          challenge_id: string;
          email: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          challenge_id: string;
          email: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          token?: string;
          challenge_id?: string;
          email?: string;
          expires_at?: string;
          used_at?: string | null;
        };
      };
      challenge_participants: {
        Row: {
          id: string;
          challenge_id: string;
          user_id: string | null;
          email: string | null;
          status: string;
          card_id: string | null;
          placement: number | null;
          score: number | null;
          is_creator: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          challenge_id: string;
          user_id?: string | null;
          email?: string | null;
          status?: string;
          card_id?: string | null;
          placement?: number | null;
          score?: number | null;
          is_creator?: boolean;
          created_at?: string;
        };
        Update: {
          challenge_id?: string;
          user_id?: string | null;
          email?: string | null;
          status?: string;
          card_id?: string | null;
          placement?: number | null;
          score?: number | null;
          is_creator?: boolean;
        };
      };
    };
    Enums: {
      stat_category: StatCategory;
      game_status: GameStatus;
      card_status: CardStatus;
      pick_selection: PickSelection;
      pick_result: PickResult;
      challenge_status: ChallengeStatus;
      friendship_status: FriendshipStatus;
      notification_type: NotificationType;
      achievement_tier: AchievementTier;
      achievement_category: AchievementCategory;
      game_mode: GameMode;
      reaction_emoji: ReactionEmoji;
      reaction_target_type: ReactionTargetType;
    };
  };
}

// Convenience type aliases
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Game = Database["public"]["Tables"]["games"]["Row"];
export type Prop = Database["public"]["Tables"]["props"]["Row"];
export type Card = Database["public"]["Tables"]["cards"]["Row"];
export type Pick = Database["public"]["Tables"]["picks"]["Row"];
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type FeatureFlag =
  Database["public"]["Tables"]["feature_flags"]["Row"];
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type Achievement = Database["public"]["Tables"]["achievements"]["Row"];
export type UserAchievement =
  Database["public"]["Tables"]["user_achievements"]["Row"];
export type Reaction = Database["public"]["Tables"]["reactions"]["Row"];
export type LeaderboardEntry =
  Database["public"]["Tables"]["leaderboard_entries"]["Row"];
export type Recap = Database["public"]["Tables"]["recaps"]["Row"];
export type GuestToken = Database["public"]["Tables"]["guest_tokens"]["Row"];
export type ChallengeParticipant =
  Database["public"]["Tables"]["challenge_participants"]["Row"];

export type LobbyType = "1v1" | "group";

export type ParticipantStatus = "invited" | "accepted" | "declined" | "active";
