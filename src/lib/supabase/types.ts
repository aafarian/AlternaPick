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
  | "blk_stl";

export type GameStatus =
  | "scheduled"
  | "live"
  | "final"
  | "postponed"
  | "cancelled";

export type CardStatus = "draft" | "locked" | "resolved";

export type PickSelection = "over" | "under";

export type PickResult = "pending" | "hit" | "miss";

export type ChallengeStatus =
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
  | "card_resolved";

export type NotificationPreferences = Record<NotificationType, boolean>;

export type AchievementTier = "standard" | "gold" | "legendary";

export type AchievementCategory =
  | "cards"
  | "streaks"
  | "accuracy"
  | "social"
  | "special";

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
          nba_game_id: string | null;
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
          nba_game_id?: string | null;
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
          nba_game_id?: string | null;
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
          opponent_id: string;
          status: ChallengeStatus;
          winner_id: string | null;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          challenger_id: string;
          opponent_id: string;
          status?: ChallengeStatus;
          winner_id?: string | null;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          challenger_id?: string;
          opponent_id?: string;
          status?: ChallengeStatus;
          winner_id?: string | null;
          resolved_at?: string | null;
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
      leaderboard_entries: {
        Row: {
          id: string;
          user_id: string;
          total_cards: number;
          total_correct_picks: number;
          win_rate: number;
          current_streak: number;
          best_streak: number;
          daily_streak: number;
          best_daily_streak: number;
          last_played_date: string | null;
          h2h_wins: number;
          h2h_losses: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_cards?: number;
          total_correct_picks?: number;
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
export type Friendship = Database["public"]["Tables"]["friendships"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type LeaderboardEntry =
  Database["public"]["Tables"]["leaderboard_entries"]["Row"];
