-- ============================================================
-- Competition catalogue.
--
-- The website advertises fifteen competition formats; the database held one
-- competition across seven seasons. This closes that gap without inventing
-- history.
--
-- Two kinds of row now live in `competitions`, told apart by `season`:
--
--   season IS NULL  — the format itself, e.g. "Men's 9s Championship".
--                     This is what the website's nav and /competitions/<slug>
--                     links resolve against.
--   season SET      — an edition that actually ran, carrying the fixtures.
--
-- Nothing here claims a competition took place. The catalogue rows have no
-- season, no dates and no fixtures; they say the federation runs that format.
-- Create a seasoned row from the admin when an edition is played.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── 1. Name the existing championship the way the website does ──
-- All seven rows are division 'men', type 'League' and are the men's 13s
-- championship; "Rugby League 13s Championship" was an internal name.
update competitions
set name = 'Men''s 13s Championship'
where name = 'Rugby League 13s Championship'
  and coalesce(division, 'men') = 'men';

-- Re-slug them as editions, freeing the bare slug for the catalogue row.
update competitions
set slug = 'mens-13s-championship-' || season
where name = 'Men''s 13s Championship'
  and season is not null
  and (slug is null or slug <> 'mens-13s-championship-' || season);

-- ── 2. The catalogue ────────────────────────────────────────
insert into competitions (name, slug, logo_url, banner_url, division, type, season, status)
values
  ('Men''s 13s Championship', 'mens-13s-championship', '/competitions/m13c.png', null, 'men', 'League', null, 'upcoming'),
  ('Women''s 13s Championship', 'womens-13s-championship', '/competitions/w13c.png', null, 'women', 'League', null, 'upcoming'),
  ('Youth 13s Championship', 'youth-13s-championship', '/competitions/y13c.png', null, 'youth', 'League', null, 'upcoming'),
  ('Men''s 9s Championship', 'mens-9s-championship', '/competitions/9s.png', '/competitions/men9s.png', 'men', 'League', null, 'upcoming'),
  ('Women''s 9s Championship', 'womens-9s-championship', '/competitions/9s.png', '/competitions/women9s.png', 'women', 'League', null, 'upcoming'),
  ('Youth 9s Championship', 'youth-9s-championship', '/competitions/9s.png', '/competitions/youth9s.png', 'youth', 'League', null, 'upcoming'),
  ('Men''s Origins Cup', 'mens-origins-cup', null, null, 'men', 'Cup', null, 'upcoming'),
  ('Women''s Origins Cup', 'womens-origins-cup', null, null, 'women', 'Cup', null, 'upcoming'),
  ('Youth Origins Cup', 'youth-origins-cup', null, null, 'youth', 'Cup', null, 'upcoming'),
  ('Men''s President''s Cup', 'mens-presidents-cup', null, null, 'men', 'Cup', null, 'upcoming'),
  ('Women''s President''s Cup', 'womens-presidents-cup', null, null, 'women', 'Cup', null, 'upcoming'),
  ('Youth President''s Cup', 'youth-presidents-cup', null, null, 'youth', 'Cup', null, 'upcoming'),
  ('Beach Rugby League', 'beach-rugby-league', null, null, 'men', 'Tournament', null, 'upcoming'),
  ('eRugby League', 'erugby-league', null, null, 'men', 'Tournament', null, 'upcoming'),
  ('Youth Girls’ Rugby League 13s Championship', 'youth-girls-13s-championship', null, null, 'youth', 'League', null, 'upcoming')
-- competitions_slug_key is a partial index (where slug is not null), so the
-- conflict target has to repeat that predicate for Postgres to infer it.
on conflict (slug) where slug is not null do update set
  name       = excluded.name,
  logo_url   = coalesce(excluded.logo_url, competitions.logo_url),
  banner_url = coalesce(excluded.banner_url, competitions.banner_url),
  division   = excluded.division,
  type       = excluded.type;

-- ── 3. Give the editions their format's artwork ─────────────
update competitions e
set logo_url   = coalesce(e.logo_url, f.logo_url),
    banner_url = coalesce(e.banner_url, f.banner_url)
from competitions f
where f.season is null
  and e.season is not null
  and e.name = f.name;
