-- ============================================================
-- GRLF (Ghana Rugby League Federation) — schema
-- Run this in Supabase SQL editor (project RL_API)
-- Idempotent: safe to re-run.
-- ============================================================

-- VENUES
create table if not exists venues (
  venue_id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  city text,
  capacity integer,
  created_at timestamptz default now()
);

-- TEAMS
create table if not exists teams (
  team_id uuid primary key default gen_random_uuid(),
  name text not null,
  region text,
  city text,
  logo_url text,
  founded_year integer,
  home_venue_id uuid references venues(venue_id),
  manager_name text,
  coach_name text,
  created_at timestamptz default now()
);

-- PLAYERS
-- Note: `age` is NOT a stored generated column because age(date_of_birth)
-- is not immutable. Age is computed on read in public_players view and in queries.
create table if not exists players (
  player_id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(team_id),
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  height_cm integer,
  weight_kg integer,
  nationality text,
  jersey_number integer,
  position text,
  is_captain boolean default false,
  playing_status text default 'active',
  photo_url text,
  phone text,
  email text,
  created_at timestamptz default now()
);

-- PLAYER HISTORY
create table if not exists player_history (
  history_id uuid primary key default gen_random_uuid(),
  player_id uuid references players(player_id),
  team_id uuid references teams(team_id),
  season text,
  role text,
  joined_date date,
  left_date date,
  notes text,
  created_at timestamptz default now()
);

-- OFFICIALS
create table if not exists officials (
  official_id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  role text,
  region text,
  nationality text,
  date_of_birth date,
  photo_url text,
  phone text,
  email text,
  status text default 'active',
  created_at timestamptz default now()
);

-- COMPETITIONS
create table if not exists competitions (
  competition_id uuid primary key default gen_random_uuid(),
  name text not null,
  season text,
  type text,
  status text default 'upcoming',
  start_date date,
  end_date date,
  created_at timestamptz default now()
);

-- FIXTURES
create table if not exists fixtures (
  fixture_id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(competition_id),
  home_team_id uuid references teams(team_id),
  away_team_id uuid references teams(team_id),
  venue_id uuid references venues(venue_id),
  scheduled_date date,
  scheduled_time time,
  round text,
  status text default 'scheduled',
  created_at timestamptz default now()
);

-- FIXTURE OFFICIALS
create table if not exists fixture_officials (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(fixture_id),
  official_id uuid references officials(official_id),
  role text,
  created_at timestamptz default now()
);

-- MATCH RESULTS
create table if not exists match_results (
  result_id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(fixture_id) unique,
  home_score integer default 0,
  away_score integer default 0,
  home_tries integer default 0,
  away_tries integer default 0,
  home_conversions integer default 0,
  away_conversions integer default 0,
  home_penalties integer default 0,
  away_penalties integer default 0,
  home_drop_goals integer default 0,
  away_drop_goals integer default 0,
  attendance integer,
  notes text,
  recorded_by text,
  recorded_at timestamptz default now()
);

-- MATCH EVENTS
create table if not exists match_events (
  event_id uuid primary key default gen_random_uuid(),
  fixture_id uuid references fixtures(fixture_id),
  player_id uuid references players(player_id),
  team_id uuid references teams(team_id),
  event_type text not null,
  minute integer,
  half integer,
  notes text,
  created_at timestamptz default now()
);

-- SUSPENSIONS
create table if not exists suspensions (
  suspension_id uuid primary key default gen_random_uuid(),
  player_id uuid references players(player_id),
  fixture_id uuid references fixtures(fixture_id),
  reason text,
  matches_banned integer,
  start_date date,
  end_date date,
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

-- STANDINGS VIEW
create or replace view standings as
select
  t.team_id, t.name as team_name, t.logo_url,
  c.competition_id, c.name as competition_name,
  count(r.result_id) as played,
  count(case when (f.home_team_id = t.team_id and r.home_score > r.away_score) or (f.away_team_id = t.team_id and r.away_score > r.home_score) then 1 end) as won,
  count(case when (f.home_team_id = t.team_id and r.home_score < r.away_score) or (f.away_team_id = t.team_id and r.away_score < r.home_score) then 1 end) as lost,
  count(case when r.home_score = r.away_score then 1 end) as drawn,
  sum(case when f.home_team_id = t.team_id then r.home_score else r.away_score end) as points_for,
  sum(case when f.home_team_id = t.team_id then r.away_score else r.home_score end) as points_against,
  (count(case when (f.home_team_id = t.team_id and r.home_score > r.away_score) or (f.away_team_id = t.team_id and r.away_score > r.home_score) then 1 end) * 2) + (count(case when r.home_score = r.away_score then 1 end)) as league_points
from teams t
join fixtures f on f.home_team_id = t.team_id or f.away_team_id = t.team_id
join competitions c on c.competition_id = f.competition_id
join match_results r on r.fixture_id = f.fixture_id
where f.status = 'completed'
group by t.team_id, t.name, t.logo_url, c.competition_id, c.name
order by league_points desc;

-- PUBLIC VIEWS (hide phone and email, compute age on read)
drop view if exists public_players;
create view public_players as
select
  player_id, team_id, first_name, last_name, date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer end as age,
  height_cm, weight_kg, nationality, jersey_number, position,
  is_captain, playing_status, photo_url, created_at
from players;

drop view if exists public_officials;
create view public_officials as
select
  official_id, first_name, last_name, role, region, nationality, date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer end as age,
  photo_url, status, created_at
from officials;

-- ROW LEVEL SECURITY
alter table players enable row level security;
alter table officials enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'players' and policyname = 'public read players'
  ) then
    create policy "public read players" on players for select using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'officials' and policyname = 'public read officials'
  ) then
    create policy "public read officials" on officials for select using (true);
  end if;
end$$;
