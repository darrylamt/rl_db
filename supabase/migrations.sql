-- ============================================================
-- RLFG Migrations — run in Supabase SQL editor
-- Safe to re-run (idempotent where possible)
-- ============================================================

-- 1. PLAYER REGISTRATIONS
-- Tracks which players are officially registered for each season year.
create table if not exists player_registrations (
  registration_id uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(player_id) on delete cascade,
  team_id         uuid references teams(team_id),
  season_year     integer not null,
  registered_at   timestamptz default now(),
  notes           text,
  constraint uq_player_year unique (player_id, season_year)
);

alter table player_registrations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'player_registrations'
      and policyname = 'public read player_registrations'
  ) then
    create policy "public read player_registrations"
      on player_registrations for select using (true);
  end if;
end$$;

-- 2. MATCH LINEUPS
-- Squad/lineup selections per fixture per team.
create table if not exists match_lineups (
  lineup_id      uuid primary key default gen_random_uuid(),
  fixture_id     uuid not null references fixtures(fixture_id) on delete cascade,
  team_id        uuid not null references teams(team_id),
  player_id      uuid not null references players(player_id),
  jersey_number  integer,
  position       text,
  is_starter     boolean default true,
  created_at     timestamptz default now(),
  constraint uq_fixture_team_player unique (fixture_id, team_id, player_id)
);

alter table match_lineups enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'match_lineups'
      and policyname = 'public read match_lineups'
  ) then
    create policy "public read match_lineups"
      on match_lineups for select using (true);
  end if;
end$$;

-- 3. STORAGE BUCKETS for logos and player photos
-- Run these only if buckets do not already exist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'team-logos', 'team-logos', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
) on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'player-photos', 'player-photos', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
) on conflict (id) do nothing;

-- Storage RLS policies (team-logos)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Public read team-logos') then
    create policy "Public read team-logos" on storage.objects for select using (bucket_id = 'team-logos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated insert team-logos') then
    create policy "Authenticated insert team-logos" on storage.objects for insert with check (bucket_id = 'team-logos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated update team-logos') then
    create policy "Authenticated update team-logos" on storage.objects for update using (bucket_id = 'team-logos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated delete team-logos') then
    create policy "Authenticated delete team-logos" on storage.objects for delete using (bucket_id = 'team-logos');
  end if;
end$$;

-- Storage RLS policies (player-photos)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Public read player-photos') then
    create policy "Public read player-photos" on storage.objects for select using (bucket_id = 'player-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated insert player-photos') then
    create policy "Authenticated insert player-photos" on storage.objects for insert with check (bucket_id = 'player-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated update player-photos') then
    create policy "Authenticated update player-photos" on storage.objects for update using (bucket_id = 'player-photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='Authenticated delete player-photos') then
    create policy "Authenticated delete player-photos" on storage.objects for delete using (bucket_id = 'player-photos');
  end if;
end$$;

-- 4. SET ALL PLAYERS INACTIVE
-- Run this once. Players become "active for a season" via player_registrations.
update players set playing_status = 'inactive' where playing_status = 'active';

-- 5. REBUILD STANDINGS VIEW
-- Drop and recreate so the new `season` column is included.
-- (PostgreSQL's CREATE OR REPLACE VIEW cannot change existing column positions.)
drop view if exists standings;
create view standings as
select
  t.team_id,
  t.name           as team_name,
  t.logo_url,
  c.competition_id,
  c.name           as competition_name,
  c.season,
  count(r.result_id) as played,
  count(case
    when (f.home_team_id = t.team_id and r.home_score > r.away_score)
      or (f.away_team_id = t.team_id and r.away_score > r.home_score)
    then 1 end) as won,
  count(case
    when (f.home_team_id = t.team_id and r.home_score < r.away_score)
      or (f.away_team_id = t.team_id and r.away_score < r.home_score)
    then 1 end) as lost,
  count(case when r.home_score = r.away_score then 1 end) as drawn,
  sum(case when f.home_team_id = t.team_id then r.home_score else r.away_score end) as points_for,
  sum(case when f.home_team_id = t.team_id then r.away_score else r.home_score end) as points_against,
  -- win = 2 pts, draw = 1 pt
  (count(case
    when (f.home_team_id = t.team_id and r.home_score > r.away_score)
      or (f.away_team_id = t.team_id and r.away_score > r.home_score)
    then 1 end) * 2)
  + count(case when r.home_score = r.away_score then 1 end)
    as league_points
from teams t
join fixtures f on f.home_team_id = t.team_id or f.away_team_id = t.team_id
join competitions c on c.competition_id = f.competition_id
join match_results r on r.fixture_id = f.fixture_id
where f.status = 'completed'
group by t.team_id, t.name, t.logo_url, c.competition_id, c.name, c.season
order by league_points desc, points_for desc;
