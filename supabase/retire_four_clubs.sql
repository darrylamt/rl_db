-- ============================================================
-- Retire Accra Bears, Accra Majestics, Pirates and African Warriors.
--
-- The fixtures stay. That is the whole reason the team rows stay too:
-- between them these four appear in 68 fixtures, and a team row is what a
-- fixture points at. Delete the row and either the database refuses it or,
-- where a key cascades, the fixture goes with it — results vanishing out of
-- competitions that were played and won.
--
-- So they are retired rather than deleted: off the public site, out of every
-- list where something new gets filed, and still attached to everything they
-- did. Two of them are already marked that way.
--
--   Accra Bears        0 players    8 fixtures
--   Accra Majestics   27 players   30 fixtures
--   Pirates            0 players   12 fixtures
--   African Warriors  25 players   18 fixtures
--
-- The 52 players at Majestics and Warriors are released and left with no
-- club, which puts them in the transfer market as free agents. Bears and
-- Pirates have nobody to release.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── What is about to change ─────────────────────────────────
select
  t.name,
  t.is_public,
  count(distinct p.player_id) as players_to_release,
  (select count(*) from fixtures f
    where f.home_team_id = t.team_id or f.away_team_id = t.team_id) as fixtures_kept
from teams t
left join players p on p.team_id = t.team_id
where t.name in ('Accra Bears', 'Accra Majestics', 'Pirates', 'African Warriors')
group by t.team_id, t.name, t.is_public
order by t.name;

-- ── 1. Close spells that are still open ─────────────────────
update player_history h
set left_date = coalesce(h.left_date, current_date),
    notes = coalesce(h.notes || ' ', '') || 'Club retired.'
from teams t
where t.team_id = h.team_id
  and t.name in ('Accra Bears', 'Accra Majestics', 'Pirates', 'African Warriors')
  and h.left_date is null;

-- ── 2. Release the players ──────────────────────────────────
-- Their history, events and line-up places stay: those point at the fixture
-- and the club directly, not at where the player is registered now.
update players p
set team_id = null
from teams t
where t.team_id = p.team_id
  and t.name in ('Accra Bears', 'Accra Majestics', 'Pirates', 'African Warriors');

-- ── 3. Retire the clubs ─────────────────────────────────────
update teams
set is_public = false
where name in ('Accra Bears', 'Accra Majestics', 'Pirates', 'African Warriors');

-- ── What it looks like now ──────────────────────────────────
select
  (select count(*) from teams where team_type = 'club' and is_public)      as clubs_still_running,
  (select count(*) from players where team_id is null)                     as players_with_no_club,
  (select count(*) from fixtures f join teams t on t.team_id in (f.home_team_id, f.away_team_id)
    where t.name in ('Accra Bears','Accra Majestics','Pirates','African Warriors')) as fixtures_still_there;
