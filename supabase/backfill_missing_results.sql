-- ============================================================
-- Build the missing results from the events already recorded.
--
-- Full time used to mark the fixture completed and stop there, so a match
-- run through the match-day screens finished with every event on record and
-- no row in match_results. The admin's Results page joins that table, so
-- those matches were nowhere, and the club portal — which reads a match as
-- upcoming until it has a result — still had them under "coming up" hours
-- after they were played.
--
-- Full time writes the result now. This is for the matches that finished
-- before it did.
--
-- Only completed fixtures with events and no result are touched. Anything
-- already recorded is left exactly as it is.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── What is about to be built ───────────────────────────────
select
  f.fixture_id,
  f.scheduled_date,
  h.name as home,
  a.name as away,
  count(*) filter (where e.event_type = 'try')          as tries,
  count(*) filter (where e.event_type = 'conversion')   as conversions
from fixtures f
join teams h on h.team_id = f.home_team_id
join teams a on a.team_id = f.away_team_id
join match_events e on e.fixture_id = f.fixture_id
where f.status = 'completed'
  and not exists (select 1 from match_results r where r.fixture_id = f.fixture_id)
group by f.fixture_id, f.scheduled_date, h.name, a.name
order by f.scheduled_date desc;

-- ── Build them ──────────────────────────────────────────────
-- An event can land without a team_id, so the side falls back to the club
-- the player it is credited to belongs to — the same rule the live pages use.
with scored as (
  select
    e.fixture_id,
    coalesce(e.team_id, p.team_id) as team_id,
    e.event_type
  from match_events e
  left join players p on p.player_id = e.player_id
),
tally as (
  select
    f.fixture_id,
    f.home_team_id,
    f.away_team_id,
    sum(case when s.team_id = f.home_team_id then
      case s.event_type when 'try' then 4 when 'conversion' then 2
                        when 'penalty_goal' then 2 when 'penalty' then 2
                        when 'drop_goal' then 1 else 0 end
    else 0 end) as home_score,
    sum(case when s.team_id = f.away_team_id then
      case s.event_type when 'try' then 4 when 'conversion' then 2
                        when 'penalty_goal' then 2 when 'penalty' then 2
                        when 'drop_goal' then 1 else 0 end
    else 0 end) as away_score,
    count(*) filter (where s.team_id = f.home_team_id and s.event_type = 'try')            as home_tries,
    count(*) filter (where s.team_id = f.away_team_id and s.event_type = 'try')            as away_tries,
    count(*) filter (where s.team_id = f.home_team_id and s.event_type = 'conversion')     as home_conversions,
    count(*) filter (where s.team_id = f.away_team_id and s.event_type = 'conversion')     as away_conversions,
    count(*) filter (where s.team_id = f.home_team_id and s.event_type in ('penalty_goal','penalty')) as home_penalties,
    count(*) filter (where s.team_id = f.away_team_id and s.event_type in ('penalty_goal','penalty')) as away_penalties,
    count(*) filter (where s.team_id = f.home_team_id and s.event_type = 'drop_goal')      as home_drop_goals,
    count(*) filter (where s.team_id = f.away_team_id and s.event_type = 'drop_goal')      as away_drop_goals
  from fixtures f
  join scored s on s.fixture_id = f.fixture_id
  where f.status = 'completed'
    and not exists (select 1 from match_results r where r.fixture_id = f.fixture_id)
  group by f.fixture_id, f.home_team_id, f.away_team_id
)
insert into match_results (
  fixture_id, home_score, away_score,
  home_tries, away_tries, home_conversions, away_conversions,
  home_penalties, away_penalties, home_drop_goals, away_drop_goals,
  recorded_by, notes
)
select
  fixture_id, home_score, away_score,
  home_tries, away_tries, home_conversions, away_conversions,
  home_penalties, away_penalties, home_drop_goals, away_drop_goals,
  'match day entry',
  'Built from the recorded events.'
from tally
on conflict (fixture_id) do nothing;

-- ── What was built ──────────────────────────────────────────
select f.scheduled_date, h.name as home, r.home_score, r.away_score, a.name as away, r.notes
from match_results r
join fixtures f on f.fixture_id = r.fixture_id
join teams h on h.team_id = f.home_team_id
join teams a on a.team_id = f.away_team_id
where r.notes = 'Built from the recorded events.'
order by f.scheduled_date desc;
