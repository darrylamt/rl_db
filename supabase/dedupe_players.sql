-- ============================================================
-- Merge duplicated player records.
--
-- Twelve people are on record twice — same name, same date of birth, all of
-- them Titans, evidently imported in two passes. One copy usually holds the
-- club and the other holds nothing, so a squad list shows the player twice
-- and their career is split across two profiles.
--
-- Players are matched on name AND date of birth. Name alone is not enough:
-- two different people can share one, and this federation already writes the
-- same person's name more than one way.
--
-- Everything attached to the discarded copy — events, line-ups, ratings,
-- registrations, history, suspensions — moves to the survivor first, so no
-- appearance or statistic is lost.
--
-- Run once in the Supabase SQL editor. Safe to re-run: once merged there is
-- nothing left to match.
-- ============================================================

drop table if exists _dupe_players;

create temp table _dupe_players as
select
  player_id,
  first_value(player_id) over w as keep_id,
  row_number()          over w as rn
from players
where date_of_birth is not null
window w as (
  partition by lower(trim(first_name)), lower(trim(last_name)), date_of_birth
  -- Keep the copy that carries a club; fall back to the earliest row so the
  -- choice is deterministic rather than whatever the planner returns.
  order by (team_id is null), created_at, player_id
);

delete from _dupe_players where rn = 1;

-- ── Move the children across ────────────────────────────────
-- Three of these tables have a uniqueness rule that the merge could violate,
-- so any row that would collide with one the survivor already has is dropped
-- before the repoint.

delete from match_lineups l
using _dupe_players d
where l.player_id = d.player_id
  and exists (
    select 1 from match_lineups k
    where k.fixture_id = l.fixture_id and k.team_id = l.team_id
      and k.player_id = d.keep_id
  );

delete from match_player_ratings r
using _dupe_players d
where r.player_id = d.player_id
  and exists (
    select 1 from match_player_ratings k
    where k.fixture_id = r.fixture_id and k.player_id = d.keep_id
  );

delete from player_registrations pr
using _dupe_players d
where pr.player_id = d.player_id
  and exists (
    select 1 from player_registrations k
    where k.season_year = pr.season_year and k.player_id = d.keep_id
  );

update match_events        e  set player_id = d.keep_id from _dupe_players d where e.player_id  = d.player_id;
update match_lineups       l  set player_id = d.keep_id from _dupe_players d where l.player_id  = d.player_id;
update match_player_ratings r set player_id = d.keep_id from _dupe_players d where r.player_id  = d.player_id;
update player_registrations pr set player_id = d.keep_id from _dupe_players d where pr.player_id = d.player_id;
update player_history      h  set player_id = d.keep_id from _dupe_players d where h.player_id  = d.player_id;
update suspensions         s  set player_id = d.keep_id from _dupe_players d where s.player_id  = d.player_id;

-- ── Carry over anything the survivor is missing ─────────────
update players k
set team_id     = coalesce(k.team_id, l.team_id),
    photo_url   = coalesce(k.photo_url, l.photo_url),
    position    = coalesce(k.position, l.position),
    height_cm   = coalesce(k.height_cm, l.height_cm),
    weight_kg   = coalesce(k.weight_kg, l.weight_kg),
    nationality = coalesce(k.nationality, l.nationality),
    phone       = coalesce(k.phone, l.phone),
    email       = coalesce(k.email, l.email)
from _dupe_players d
join players l on l.player_id = d.player_id
where k.player_id = d.keep_id;

delete from players p using _dupe_players d where p.player_id = d.player_id;

drop table _dupe_players;
