-- ============================================================
-- Retire Accra Majestics and African Warriors.
--
-- READ THIS FIRST — the team rows are NOT deleted, on purpose.
--
-- Between them the two clubs are attached to 48 fixtures, 120 match events,
-- 212 line-up places and 55 recorded spells. Those are past seasons that
-- were played. Deleting the team rows would either be refused by the
-- database or, where a foreign key cascades, take that history with it —
-- results would vanish from completed competitions and players would lose
-- the seasons they spent at these clubs.
--
-- Retiring is what was actually wanted: the clubs stop being somewhere a
-- player can be, stop appearing as an option anywhere, and what they did
-- stays on record. Both are already marked is_public = false, so neither has
-- been on the public website for some time.
--
-- The players are released. Anyone still registered to either club is left
-- with no club, which is the state this script is for. Anyone who has
-- already moved is not touched — their team_id is not these clubs, so
-- nothing below matches them.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── What is about to change ─────────────────────────────────
select
  t.name,
  t.is_public,
  count(p.player_id)                                          as players_to_release,
  count(p.player_id) filter (where p.category = 'youth')       as youth,
  count(p.player_id) filter (where p.category = 'senior_women') as women,
  count(p.player_id) filter (where p.category = 'senior_men')   as men
from teams t
left join players p on p.team_id = t.team_id
where t.name in ('Accra Majestics', 'African Warriors')
group by t.name, t.is_public;

-- ── 1. Close the spells that are still open ─────────────────
-- Done before the release, while it is still recorded who they were with.
update player_history h
set left_date = coalesce(h.left_date, current_date),
    notes = coalesce(h.notes || ' ', '') || 'Club retired.'
from teams t
where t.team_id = h.team_id
  and t.name in ('Accra Majestics', 'African Warriors')
  and h.left_date is null;

-- ── 2. Release the players ──────────────────────────────────
-- Their history, events and line-up places all stay: those reference the
-- fixture and the club directly, not the player's current registration.
update players p
set team_id = null
from teams t
where t.team_id = p.team_id
  and t.name in ('Accra Majestics', 'African Warriors');

-- ── 3. Retire the clubs ─────────────────────────────────────
-- Off the public site, and no longer a club anything new can be filed
-- against. team_type stays 'club' so the rows keep their meaning in the
-- fixtures they appear in.
update teams
set is_public = false
where name in ('Accra Majestics', 'African Warriors');

-- ── What it looks like now ──────────────────────────────────
select
  (select count(*) from players where team_id is null) as players_with_no_club,
  (select count(*) from players p join teams t on t.team_id = p.team_id
    where t.name in ('Accra Majestics', 'African Warriors'))
    as still_at_a_retired_club;
