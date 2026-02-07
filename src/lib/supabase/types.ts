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

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string | null;
          avatar_url?: string | null;
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
          stat_category: StatCategory;
          line: number;
          over_odds: number | null;
          under_odds: number | null;
          bookmaker: string | null;
          fetched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          player_name: string;
          player_id?: string | null;
          stat_category: StatCategory;
          line: number;
          over_odds?: number | null;
          under_odds?: number | null;
          bookmaker?: string | null;
          fetched_at?: string;
          created_at?: string;
        };
        Update: {
          game_id?: string;
          player_name?: string;
          player_id?: string | null;
          stat_category?: StatCategory;
          line?: number;
          over_odds?: number | null;
          under_odds?: number | null;
          bookmaker?: string | null;
          fetched_at?: string;
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
      leaderboard_entries: {
        Row: {
          id: string;
          user_id: string;
          total_cards: number;
          total_correct_picks: number;
          win_rate: number;
          current_streak: number;
          best_streak: number;
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
export type LeaderboardEntry =
  Database["public"]["Tables"]["leaderboard_entries"]["Row"];
