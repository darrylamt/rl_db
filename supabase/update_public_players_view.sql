-- ── update_public_players_view ───────────────────────────────────────────────
-- Adds `rating` to the public_players view so the public API exposes it.
-- Run AFTER player_general_rating.sql (which adds the rating column to players).
--
-- Note: CREATE OR REPLACE VIEW cannot remove/reorder columns.
-- We DROP and recreate so we can add `rating` in the right position.

DROP VIEW IF EXISTS public.public_players;

CREATE VIEW public.public_players
  WITH (security_invoker = true)
AS
SELECT
  player_id,
  team_id,
  first_name,
  last_name,
  date_of_birth,
  CASE WHEN date_of_birth IS NULL THEN NULL
       ELSE extract(year FROM age(date_of_birth))::integer
  END AS age,
  height_cm,
  weight_kg,
  nationality,
  jersey_number,
  position,
  is_captain,
  playing_status,
  photo_url,
  COALESCE(rating, 6.0) AS rating,
  created_at
FROM public.players;

-- Re-grant SELECT to anon and authenticated (dropped with the view)
GRANT SELECT ON public.public_players TO anon, authenticated;
