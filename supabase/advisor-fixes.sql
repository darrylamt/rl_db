-- ============================================================
-- GRLF — Supabase Advisor Fixes
-- Resolves 12 Performance/Security lints:
--   - 3 × security_definer_view: public_players, public_officials, standings
--   - 9 × rls_disabled_in_public: venues, teams, player_history,
--       competitions, fixtures, fixture_officials, match_results,
--       match_events, suspensions
--
-- Design notes:
--   - Admin routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
--     Public /enter/* forms and /api GET routes use the anon key and
--     therefore need explicit policies.
--   - We grant public SELECT on everything so the public site can read.
--   - Public INSERT is only enabled where the /enter/* forms need it:
--       match_results, match_events, fixtures (enter/fixture form).
--   - Writes on all other tables are reserved for the service role.
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Recreate the three views as SECURITY INVOKER so they
--    honor the querying user's RLS rather than the view owner's.
-- ------------------------------------------------------------

drop view if exists public_players;
create view public_players
  with (security_invoker = true)
as
select
  player_id, team_id, first_name, last_name, date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer end as age,
  height_cm, weight_kg, nationality, jersey_number, position,
  is_captain, playing_status, photo_url, created_at
from players;

drop view if exists public_officials;
create view public_officials
  with (security_invoker = true)
as
select
  official_id, first_name, last_name, role, region, nationality, date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer end as age,
  photo_url, status, created_at
from officials;

drop view if exists standings;
create view standings
  with (security_invoker = true)
as
select
  t.team_id, t.name as team_name, t.logo_url,
  c.competition_id, c.name as competition_name,
  count(r.result_id) as played,
  count(case when (f.home_team_id = t.team_id and r.home_score > r.away_score)
               or (f.away_team_id = t.team_id and r.away_score > r.home_score)
             then 1 end) as won,
  count(case when (f.home_team_id = t.team_id and r.home_score < r.away_score)
               or (f.away_team_id = t.team_id and r.away_score < r.home_score)
             then 1 end) as lost,
  count(case when r.home_score = r.away_score then 1 end) as drawn,
  sum(case when f.home_team_id = t.team_id then r.home_score else r.away_score end) as points_for,
  sum(case when f.home_team_id = t.team_id then r.away_score else r.home_score end) as points_against,
  (count(case when (f.home_team_id = t.team_id and r.home_score > r.away_score)
                or (f.away_team_id = t.team_id and r.away_score > r.home_score)
              then 1 end) * 2)
  + (count(case when r.home_score = r.away_score then 1 end)) as league_points
from teams t
join fixtures f on f.home_team_id = t.team_id or f.away_team_id = t.team_id
join competitions c on c.competition_id = f.competition_id
join match_results r on r.fixture_id = f.fixture_id
where f.status = 'completed'
group by t.team_id, t.name, t.logo_url, c.competition_id, c.name
order by league_points desc;

-- ------------------------------------------------------------
-- 2) Enable RLS on the 9 remaining public tables.
-- ------------------------------------------------------------

alter table venues            enable row level security;
alter table teams             enable row level security;
alter table player_history    enable row level security;
alter table competitions      enable row level security;
alter table fixtures          enable row level security;
alter table fixture_officials enable row level security;
alter table match_results     enable row level security;
alter table match_events      enable row level security;
alter table suspensions       enable row level security;

-- ------------------------------------------------------------
-- 3) Public SELECT policies — everything in public schema is
--    readable by anon/authenticated.
-- ------------------------------------------------------------

do $$
declare
  t text;
  read_tables text[] := array[
    'venues', 'teams', 'player_history', 'competitions',
    'fixtures', 'fixture_officials', 'match_results',
    'match_events', 'suspensions'
  ];
begin
  foreach t in array read_tables loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and policyname = 'public read ' || t
    ) then
      execute format(
        'create policy %I on %I for select using (true)',
        'public read ' || t, t
      );
    end if;
  end loop;
end$$;

-- ------------------------------------------------------------
-- 4) Public INSERT policies — only where public /enter/* forms
--    need to write with the anon key.
--
--    /enter/result   -> match_results (upsert)
--    /enter/events   -> match_events  (insert)
--    /enter/fixture  -> fixtures      (insert)
--    /enter/result   -> fixtures      (update status='completed')
--
--    We also allow public UPDATE on fixtures so /enter/result can
--    mark a fixture completed. Everything else is service-role only.
-- ------------------------------------------------------------

do $$
begin
  -- match_results: insert + update (upsert by fixture_id)
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'match_results' and policyname = 'public insert match_results') then
    create policy "public insert match_results" on match_results for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'match_results' and policyname = 'public update match_results') then
    create policy "public update match_results" on match_results for update using (true) with check (true);
  end if;

  -- match_events: insert only
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'match_events' and policyname = 'public insert match_events') then
    create policy "public insert match_events" on match_events for insert with check (true);
  end if;

  -- fixtures: insert (new fixture) + update (status -> completed)
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'fixtures' and policyname = 'public insert fixtures') then
    create policy "public insert fixtures" on fixtures for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'fixtures' and policyname = 'public update fixtures') then
    create policy "public update fixtures" on fixtures for update using (true) with check (true);
  end if;
end$$;

-- ------------------------------------------------------------
-- Done.
-- Everything else (teams, players, officials, venues, competitions,
-- player_history, fixture_officials, suspensions) is read-only for
-- anon/authenticated. Admin writes go through the service role key
-- in server actions and bypass RLS.
-- ------------------------------------------------------------
