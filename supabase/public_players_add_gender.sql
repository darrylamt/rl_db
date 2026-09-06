-- ============================================================
-- The public view learns gender, so youth can be boys and girls.
--
-- Splitting youth needs a player's gender, and the public side reads
-- public_players rather than the table. The view did not carry the column, so
-- the club page asked for something that was not there, the whole select
-- failed, and every squad came back empty — "No active squad listed" on a
-- club with sixty players on the register.
--
-- WHY THIS IS NOT A PRIVACY CHANGE
--   The public side has always separated men's, women's and youth squads, so
--   which squad somebody is in has always been on the page. This adds the
--   column that says which, rather than any new fact about anybody.
--
-- WHAT IS STILL NOT HERE
--   date_of_birth and age. This file and public_players_drop_age.sql both
--   drop and recreate the view, so whichever runs last decides — and this one
--   agrees with that one deliberately. Ages stay internal, as agreed.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

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
  -- Youth is boys and girls. The grade is worked out from these two together
  -- rather than stored, because every player already has both.
  gender,
  -- Still no date_of_birth and no age. See the note above.
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

-- ── Proof it worked ─────────────────────────────────────────
-- gender present, date_of_birth and age absent.
select
  bool_or(column_name = 'gender')        as has_gender,
  bool_or(column_name = 'date_of_birth') as has_date_of_birth,
  bool_or(column_name = 'age')           as has_age
from information_schema.columns
where table_schema = 'public' and table_name = 'public_players';

-- And that squads are visible again.
select
  t.name                                    as club,
  count(*) filter (where p.category = 'youth' and p.gender = 'male')   as youth_boys,
  count(*) filter (where p.category = 'youth' and p.gender = 'female') as youth_girls,
  count(*)                                                            as squad
from public_players p
join teams t on t.team_id = p.team_id
where p.playing_status = 'active'
group by t.name
order by squad desc;
