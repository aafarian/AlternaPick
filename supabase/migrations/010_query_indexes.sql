-- Cards: user lookup by status (picks page, API)
CREATE INDEX IF NOT EXISTS idx_cards_user_status ON cards (user_id, status);

-- Cards: challenge lookup
CREATE INDEX IF NOT EXISTS idx_cards_challenge ON cards (challenge_id) WHERE challenge_id IS NOT NULL;

-- Picks: card lookup (join from cards)
CREATE INDEX IF NOT EXISTS idx_picks_card ON picks (card_id);

-- Picks: prop lookup (join from picks to props)
CREATE INDEX IF NOT EXISTS idx_picks_prop ON picks (prop_id);

-- Props: game lookup (join from props)
CREATE INDEX IF NOT EXISTS idx_props_game ON props (game_id);

-- Games: time range queries (props page, sync)
CREATE INDEX IF NOT EXISTS idx_games_commence ON games (commence_time);

-- Friendships: user lookup for both sides
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships (requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships (addressee_id, status);

-- Notifications: user lookup unread
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read);
