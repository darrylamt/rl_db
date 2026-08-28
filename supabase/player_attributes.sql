-- ── player_attributes ───────────────────────────────────────────────────────
-- Five manually-entered scouting attributes per player, 0–100, shown as the
-- radar chart on the public player page. NULL means "not rated yet" — that is
-- deliberately different from 0, so an unrated player doesn't render a flat
-- pentagon that looks like a real assessment.
--
-- Run once in the Supabase SQL editor. Safe to re-run.

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS attr_strength smallint,
  ADD COLUMN IF NOT EXISTS attr_speed    smallint,
  ADD COLUMN IF NOT EXISTS attr_iq       smallint,
  ADD COLUMN IF NOT EXISTS attr_defense  smallint,
  ADD COLUMN IF NOT EXISTS attr_ability  smallint;

-- Range checks, added separately so re-running doesn't error on duplicates.
do $$
declare
  c text;
begin
  foreach c in array array[
    'attr_strength', 'attr_speed', 'attr_iq', 'attr_defense', 'attr_ability'
  ]
  loop
    if not exists (
      select 1 from pg_constraint
      where conname = 'players_' || c || '_range'
    ) then
      execute format(
        'alter table public.players add constraint %I check (%I is null or (%I between 0 and 100))',
        'players_' || c || '_range', c, c
      );
    end if;
  end loop;
end$$;

-- ── Expose the attributes through the public view ───────────────────────────
-- CREATE OR REPLACE VIEW cannot add columns mid-list, so drop and recreate.

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
  attr_strength,
  attr_speed,
  attr_iq,
  attr_defense,
  attr_ability,
  created_at
FROM public.players;

-- Re-grant SELECT to anon and authenticated (dropped with the view)
GRANT SELECT ON public.public_players TO anon, authenticated;
