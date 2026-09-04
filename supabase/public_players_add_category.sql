-- ----------------------------------------------------------------------
-- Add `category` to the public_players view.
--
-- A club fields men's, women's and youth sides from one team row, and the
-- grade lives on the player. Without it on the public view, a club's public
-- page can only show one undifferentiated list of every player at the club —
-- which is not how anybody thinks about a squad.
--
-- Nothing private is added: category is the grade a player is registered in,
-- already shown throughout the admin and club portals. Phone and email stay
-- out of the view, which is what it exists to keep out.
--
-- CREATE OR REPLACE VIEW cannot add a column in the middle, so this drops and
-- recreates. Keep the column list in step with the live players table.
-- ----------------------------------------------------------------------

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
  secondary_positions,
  category,
  is_captain,
  playing_status,
  photo_url,
  COALESCE(rating, 6.0) AS rating,
  attr_strength,
  attr_speed,
  attr_iq,
  attr_defense,
  attr_ability,
  attr_kicking,
  created_at
FROM public.players;

-- Re-grant SELECT to anon and authenticated (dropped with the view).
GRANT SELECT ON public.public_players TO anon, authenticated;
