-- ── player_general_rating ────────────────────────────────────────────────────
-- Adds a persisted `rating` column to players (default 6.0).
-- The column is recomputed (server-side) whenever match_player_ratings are saved:
--   new_rating = ROUND(AVG(match_player_ratings.rating), 1)
-- Players with no match ratings stay at the default 6.0.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS rating numeric(3,1) DEFAULT 6.0
    CHECK (rating >= 1.0 AND rating <= 10.0);

-- Back-fill any existing rows from already-saved match ratings
-- (safe to run multiple times — COALESCE falls back to 6.0 when no ratings exist)
UPDATE public.players p
SET rating = COALESCE(
  (SELECT ROUND(AVG(mpr.rating)::numeric, 1)
   FROM public.match_player_ratings mpr
   WHERE mpr.player_id = p.player_id),
  6.0
);
