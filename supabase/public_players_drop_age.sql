-- ----------------------------------------------------------------------
-- Take date of birth and age off the public view.
--
-- public_players is granted SELECT to anon, and the anon key ships inside
-- the website's own JavaScript — so anybody could read every player's date
-- of birth straight from PostgREST, all 525 of them, a good part juniors.
-- Hiding the field in the pages did nothing about that; this is the part
-- that closes it.
--
-- The federation still has both: they are on players, which anon cannot
-- read. Only the public projection loses them.
--
-- Note for anything consuming the API: `date_of_birth` and `age` stop coming
-- back from /api/players and /api/players/:id after this. Nothing in this
-- app reads them any more.
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
