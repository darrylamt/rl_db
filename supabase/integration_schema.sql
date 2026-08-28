-- ============================================================
-- Integration schema — everything the public website reads that
-- the database could not yet answer.
--
-- Adds three content tables (documents, people, partners) and the
-- reference columns the site routes and renders on. Seed data is in
-- integration_seed.sql and mirrors the JSON files the site ships today,
-- so nothing changes visually when it switches over.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── 1. DOCUMENTS ────────────────────────────────────────────
-- The reports/policies library. `link` stays a URL because the current
-- documents live in Google Drive; uploads can come later without a
-- schema change.
create table if not exists documents (
  document_id   uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null,
  link          text,
  thumbnail_url text,
  published_at  date,
  sort_order    integer not null default 0,
  status        text not null default 'published',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The site filters on these four exact strings, so they are constrained
-- rather than free text.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'documents_type_check') then
    alter table documents add constraint documents_type_check
      check (type in (
        'Reports',
        'Annual General Meetings',
        'Policies',
        'Monthly Developmental Reports'
      ));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'documents_status_check') then
    alter table documents add constraint documents_status_check
      check (status in ('published', 'archived'));
  end if;
end$$;

create index if not exists documents_type_idx on documents (type, sort_order);

-- ── 2. PEOPLE ───────────────────────────────────────────────
-- Board and committee members. Distinct from `officials`, which is
-- match referees. One table with a group column so regional officers or
-- life members can be added later without another migration.
-- Column is group_name because GROUP is reserved in SQL.
create table if not exists people (
  person_id   uuid primary key default gen_random_uuid(),
  name        text not null,
  role        text,
  email       text,
  photo_url   text,
  group_name  text not null default 'board',
  sort_order  integer not null default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'people_group_check') then
    alter table people add constraint people_group_check
      check (group_name in ('board', 'committee'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'people_status_check') then
    alter table people add constraint people_status_check
      check (status in ('active', 'inactive'));
  end if;
end$$;

create index if not exists people_group_idx on people (group_name, sort_order);

-- ── 3. PARTNERS ─────────────────────────────────────────────
-- Sponsors, grouped into three named tiers. tier_title is editable copy
-- ("Official Partners"), carried per row so the tier can be renamed
-- without a deploy; the API returns one title per tier.
create table if not exists partners (
  partner_id  uuid primary key default gen_random_uuid(),
  name        text not null,
  link        text,
  logo_url    text,
  designation text,
  tier        smallint not null default 1,
  tier_title  text,
  sort_order  integer not null default 0,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partners_tier_check') then
    alter table partners add constraint partners_tier_check
      check (tier between 1 and 3);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'partners_status_check') then
    alter table partners add constraint partners_status_check
      check (status in ('active', 'inactive'));
  end if;
end$$;

create index if not exists partners_tier_idx on partners (tier, sort_order);

-- ── 4. REFERENCE COLUMNS ────────────────────────────────────
-- Competitions need their own identity on the site: a routable slug and
-- the two images the competition pages render.
alter table competitions
  add column if not exists slug       text,
  add column if not exists logo_url   text,
  add column if not exists banner_url text;

create unique index if not exists competitions_slug_key
  on competitions (slug) where slug is not null;

-- Teams: the site distinguishes a club's registered name from the name it
-- plays under, and hides some entries from public listings.
alter table teams
  add column if not exists legal_name text,
  add column if not exists is_public  boolean not null default true;

-- Fixtures: the website's URLs are readable strings like
-- "bulls-nungua-tigers-28-01-24". Without a slug column those links all
-- break when the site starts reading UUIDs from the API.
alter table fixtures
  add column if not exists slug text;

create unique index if not exists fixtures_slug_key
  on fixtures (slug) where slug is not null;

-- ── 5. UPDATED-AT TRIGGERS ──────────────────────────────────
-- set_updated_at() is created by match_player_ratings.sql; define it here
-- too so this file can run standalone.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace trigger documents_updated_at
  before update on documents
  for each row execute function public.set_updated_at();

create or replace trigger people_updated_at
  before update on people
  for each row execute function public.set_updated_at();

create or replace trigger partners_updated_at
  before update on partners
  for each row execute function public.set_updated_at();

-- ── 6. ROW LEVEL SECURITY ───────────────────────────────────
-- Public read, service-role writes — the same pattern as every other
-- table here. Admin screens use the service key and bypass RLS.
alter table documents enable row level security;
alter table people    enable row level security;
alter table partners  enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['documents', 'people', 'partners']
  loop
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

-- ── 7. SLUG BACKFILL ────────────────────────────────────
-- Slugs are editorial nicknames, not kebab-cased names: the site links to
-- /clubs/panthers, not /clubs/accra-panthers. These values come from the
-- site's own clubs.json so existing links keep resolving.
update teams set slug = 'panthers'  where name = 'Accra Panthers'   and slug is null;
update teams set slug = 'majestics' where name = 'Accra Majestics'  and slug is null;
update teams set slug = 'skolars'   where name = 'Skolars'          and slug is null;
update teams set slug = 'bulls'     where name = 'Bulls'            and slug is null;
update teams set slug = 'tigers'    where name = 'Nungua Tigers'    and slug is null;
update teams set slug = 'warriors'  where name = 'African Warriors' and slug is null;
update teams set slug = 'dragons'   where name = 'Dragons'          and slug is null;
update teams set slug = 'titans'    where name = 'Titans'           and slug is null;

-- Not present in clubs.json — slugged from the name so they route too.
update teams set slug = 'bears'   where name = 'Accra Bears' and slug is null;
update teams set slug = 'pirates' where name = 'Pirates'     and slug is null;

-- clubs.json hides these from public listings.
update teams set is_public = false
  where name in ('African Warriors', 'Accra Majestics');

-- Anything still unslugged gets a derived one, with a counter if that name is
-- already taken. Every slug column here is uniquely indexed, so a plain
-- kebab-case update would abort the whole migration on the first collision.
do $$
declare
  r         record;
  base      text;
  candidate text;
  n         integer;
begin
  for r in select team_id, name from teams where slug is null and name is not null
  loop
    base := trim(both '-' from regexp_replace(lower(trim(r.name)), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'team'; end if;
    candidate := base;
    n := 1;
    while exists (select 1 from teams where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update teams set slug = candidate where team_id = r.team_id;
  end loop;
end$$;

-- Competitions are one row per season, and every row currently shares the same
-- name, so the season is part of the identity rather than a tie-breaker: a
-- repeated name always carries its season, and a unique one stays clean.
do $$
declare
  r         record;
  base      text;
  candidate text;
  n         integer;
begin
  for r in
    select c.competition_id,
           c.name,
           c.season,
           count(*) over (partition by lower(trim(c.name))) as name_count
    from competitions c
    where c.slug is null and c.name is not null
    order by c.name, c.season
  loop
    base := trim(both '-' from regexp_replace(lower(trim(r.name)), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'competition'; end if;

    if r.name_count > 1 and r.season is not null then
      base := base || '-' || trim(both '-' from
                regexp_replace(lower(r.season::text), '[^a-z0-9]+', '-', 'g'));
    end if;

    candidate := base;
    n := 1;
    while exists (select 1 from competitions where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update competitions set slug = candidate where competition_id = r.competition_id;
  end loop;
end$$;

-- ── 8. FIXTURE SLUG BACKFILL ────────────────────────────
-- Rebuilds the site's existing URL format: home-away-dd-mm-yy, lowercased and
-- hyphenated, with a counter when the same two teams meet twice on a day.
do $$
declare
  r         record;
  base      text;
  candidate text;
  n         integer;
begin
  for r in
    select f.fixture_id,
           coalesce(h.name, 'tbc') as home_name,
           coalesce(a.name, 'tbc') as away_name,
           f.scheduled_date
    from fixtures f
    left join teams h on h.team_id = f.home_team_id
    left join teams a on a.team_id = f.away_team_id
    where f.slug is null and f.scheduled_date is not null
    order by f.scheduled_date, f.created_at, f.fixture_id
  loop
    base := trim(both '-' from regexp_replace(
      lower(r.home_name || '-' || r.away_name || '-' ||
            to_char(r.scheduled_date, 'DD-MM-YY')),
      '[^a-z0-9]+', '-', 'g'));

    candidate := base;
    n := 1;
    while exists (select 1 from fixtures where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    update fixtures set slug = candidate where fixture_id = r.fixture_id;
  end loop;
end$$;
