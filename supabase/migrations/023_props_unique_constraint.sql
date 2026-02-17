-- Remove duplicate props, keeping one per (game_id, player_name, stat_category).
-- Priority: props with picks > latest fetched_at > latest created_at > highest id.
-- This ensures user picks are NEVER cascade-deleted.
WITH ranked AS (
  SELECT p.id,
         ROW_NUMBER() OVER (
           PARTITION BY p.game_id, p.player_name, p.stat_category
           ORDER BY
             (EXISTS (SELECT 1 FROM picks pk WHERE pk.prop_id = p.id)) DESC,
             p.fetched_at DESC,
             p.created_at DESC,
             p.id DESC
         ) AS rn
  FROM props p
)
DELETE FROM props
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevent future duplicates at the DB level
CREATE UNIQUE INDEX idx_props_game_player_stat
  ON props (game_id, player_name, stat_category);
