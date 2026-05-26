-- ── scoring_leaders_view ────────────────────────────────────────────────────
-- Aggregates try and conversion (goal kick) counts per player at the DB level,
-- so the admin standings page never hits PostgREST's 1000-row default limit.
-- Run once in the Supabase SQL editor.

CREATE OR REPLACE VIEW public.scoring_leaders
  WITH (security_invoker = true)
AS
SELECT
  p.player_id,
  p.first_name,
  p.last_name,
  t.name           AS team_name,
  t.team_id,
  f.competition_id,
  LOWER(me.event_type) AS event_type,  -- normalise case once
  COUNT(*)         AS total
FROM public.match_events me
JOIN public.players      p  ON p.player_id  = me.player_id
LEFT JOIN public.teams   t  ON t.team_id    = p.team_id
JOIN public.fixtures     f  ON f.fixture_id = me.fixture_id
WHERE LOWER(me.event_type) IN ('try', 'conversion')
  AND me.player_id IS NOT NULL
GROUP BY
  p.player_id, p.first_name, p.last_name,
  t.name, t.team_id,
  f.competition_id,
  LOWER(me.event_type);

GRANT SELECT ON public.scoring_leaders TO anon, authenticated;
