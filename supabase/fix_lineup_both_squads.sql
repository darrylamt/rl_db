-- ============================================================
-- One player is in both squads of the same match.
--
-- Bulls v Accra Panthers, 11 May 2025: Darryl Amoatey is named in the Bulls
-- line-up and in the Panthers line-up. He cannot have played for both.
--
-- The Panthers entry is the one that stands. He turned out for Panthers five
-- more times that season and not once for Bulls; his move to Bulls is the
-- 2026 season, where every appearance is theirs. The Bulls row for this
-- fixture is the mistake.
--
-- Left alone, it reads as a transfer to Bulls in 2025 and back to Panthers a
-- week later, and it counts an appearance he never made.
--
-- This is the only such contradiction in the database — every other fixture
-- names each player on one side only.
--
-- Run before player_history_seed.sql. Safe to re-run.
-- ============================================================

delete from match_lineups l
using fixtures f,
     teams bulls,
     teams panthers,
     players p
where l.fixture_id = f.fixture_id
  and f.scheduled_date = date '2025-05-11'
  and bulls.name = 'Bulls'
  and panthers.name = 'Accra Panthers'
  and f.home_team_id = bulls.team_id
  and f.away_team_id = panthers.team_id
  and p.first_name = 'Darryl' and p.last_name = 'Amoatey'
  and l.player_id = p.player_id
  and l.team_id = bulls.team_id
  -- Only remove it while the Panthers entry survives, so a re-run cannot
  -- strip him from the match altogether.
  and exists (
    select 1 from match_lineups k
    where k.fixture_id = f.fixture_id
      and k.player_id = p.player_id
      and k.team_id = panthers.team_id
  );
