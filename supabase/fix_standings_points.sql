-- ── fix_standings_points ─────────────────────────────────────────────────────
-- The advisor-fixes migration accidentally set win = 2 pts instead of 3.
-- Correct: win = 3 pts, draw = 1 pt, loss = 0 pts.
-- Also restores goal_difference and proper ORDER BY tiebreaker.

DROP VIEW IF EXISTS public.standings;

CREATE VIEW public.standings
  WITH (security_invoker = true)
AS
SELECT
  t.team_id,
  t.name   AS team_name,
  t.logo_url,
  c.competition_id,
  c.name   AS competition_name,

  COUNT(r.result_id) AS played,

  COUNT(CASE
    WHEN (f.home_team_id = t.team_id AND r.home_score > r.away_score)
      OR (f.away_team_id = t.team_id AND r.away_score > r.home_score)
    THEN 1 END) AS won,

  COUNT(CASE
    WHEN (f.home_team_id = t.team_id AND r.home_score < r.away_score)
      OR (f.away_team_id = t.team_id AND r.away_score < r.home_score)
    THEN 1 END) AS lost,

  COUNT(CASE WHEN r.home_score = r.away_score THEN 1 END) AS drawn,

  SUM(CASE WHEN f.home_team_id = t.team_id THEN r.home_score ELSE r.away_score END) AS points_for,
  SUM(CASE WHEN f.home_team_id = t.team_id THEN r.away_score ELSE r.home_score END) AS points_against,

  SUM(CASE WHEN f.home_team_id = t.team_id THEN r.home_score ELSE r.away_score END)
  - SUM(CASE WHEN f.home_team_id = t.team_id THEN r.away_score ELSE r.home_score END) AS goal_difference,

  -- win = 3 pts, draw = 1 pt
  (COUNT(CASE
    WHEN (f.home_team_id = t.team_id AND r.home_score > r.away_score)
      OR (f.away_team_id = t.team_id AND r.away_score > r.home_score)
    THEN 1 END) * 3)
  + COUNT(CASE WHEN r.home_score = r.away_score THEN 1 END) AS league_points

FROM public.teams t
JOIN public.fixtures     f ON f.home_team_id = t.team_id OR f.away_team_id = t.team_id
JOIN public.competitions c ON c.competition_id = f.competition_id
JOIN public.match_results r ON r.fixture_id = f.fixture_id
WHERE f.status = 'completed'
GROUP BY t.team_id, t.name, t.logo_url, c.competition_id, c.name
ORDER BY league_points DESC, goal_difference DESC;

-- Re-grant (view was dropped)
GRANT SELECT ON public.standings TO anon, authenticated;
