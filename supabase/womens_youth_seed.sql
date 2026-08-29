-- ============================================================
-- Women's, youth, 9s, President's Cup and eRugby fixtures.
--
-- The website shipped 118 fixtures the database has never held — every
-- competition other than the men's 13s championship. All of them carry a
-- date and a final score, so standings, fixtures and results pages for the
-- women's and youth game start working from real records.
--
-- Nothing is invented. Every row below comes from data/schedule.json.
--
-- Deliberately NOT imported: line-ups and scoring events. They name 490
-- people and only 44 match a player already in the database, so importing
-- them would either invent 446 player records or produce half-counted stat
-- leaders that read as fact. Scores are unaffected — standings are computed
-- from them.
--
-- Run AFTER competition_catalogue.sql. Safe to re-run: fixtures are matched
-- on slug and nothing is duplicated.
-- ============================================================

-- ── 1. Grounds ──────────────────────────────────────────────


insert into venues (name, city, region)
select 'Prempeh College School Park', null, null
where not exists (select 1 from venues where name = 'Prempeh College School Park');

insert into venues (name, city, region)
select 'Sarbah Field', null, null
where not exists (select 1 from venues where name = 'Sarbah Field');

insert into venues (name, city, region)
select 'Wembley Park', null, null
where not exists (select 1 from venues where name = 'Wembley Park');


-- ── 2. Representative sides ─────────────────────────────────
-- National and President XIII teams, which play the cup fixtures below.
-- Kept out of public club listings, as the website already does.

insert into teams (name, slug, team_type, division, is_public)
select 'Men National Team', 'ghmnt', 'national', 'men', false
where not exists (select 1 from teams where name = 'Men National Team');

insert into teams (name, slug, team_type, division, is_public)
select 'Women National Team', 'ghwnt', 'national', 'women', false
where not exists (select 1 from teams where name = 'Women National Team');

insert into teams (name, slug, team_type, division, is_public)
select 'National Youth Team', 'ghnyt', 'national', 'youth', false
where not exists (select 1 from teams where name = 'National Youth Team');

insert into teams (name, slug, team_type, division, is_public)
select 'Men President XIII', 'men-president-xiii', 'president_xv', 'men', false
where not exists (select 1 from teams where name = 'Men President XIII');

insert into teams (name, slug, team_type, division, is_public)
select 'Women President XIII', 'women-president-xiii', 'president_xv', 'women', false
where not exists (select 1 from teams where name = 'Women President XIII');

insert into teams (name, slug, team_type, division, is_public)
select 'Youth President XIII', 'youth-president-xiii', 'president_xv', 'youth', false
where not exists (select 1 from teams where name = 'Youth President XIII');


-- ── 3. Competition editions ─────────────────────────────────
-- One row per competition per season. The catalogue rows created by
-- competition_catalogue.sql describe the format; these are the editions that
-- were actually played.

insert into competitions (name, slug, season, division, type, status)
select 'Men''s 9s Championship', 'men-s-9s-championship-2024', '2024', 'men', 'League', 'completed'
where not exists (select 1 from competitions where name = 'Men''s 9s Championship' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'Men''s President''s Cup', 'men-s-president-s-cup-2024', '2024', 'men', 'Cup', 'completed'
where not exists (select 1 from competitions where name = 'Men''s President''s Cup' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'Women''s 9s Championship', 'women-s-9s-championship-2024', '2024', 'women', 'League', 'completed'
where not exists (select 1 from competitions where name = 'Women''s 9s Championship' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'Women''s President''s Cup', 'women-s-president-s-cup-2024', '2024', 'women', 'Cup', 'completed'
where not exists (select 1 from competitions where name = 'Women''s President''s Cup' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'Youth 13s Championship', 'youth-13s-championship-2024', '2024', 'youth', 'League', 'completed'
where not exists (select 1 from competitions where name = 'Youth 13s Championship' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'Youth 13s Championship', 'youth-13s-championship-2025', '2025', 'youth', 'League', 'completed'
where not exists (select 1 from competitions where name = 'Youth 13s Championship' and season = '2025');

insert into competitions (name, slug, season, division, type, status)
select 'Youth 9s Championship', 'youth-9s-championship-2024', '2024', 'youth', 'League', 'completed'
where not exists (select 1 from competitions where name = 'Youth 9s Championship' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'Youth Girls’ Rugby League 13s Championship', 'youth-girls-rugby-league-13s-championship-2025', '2025', 'youth', 'League', 'completed'
where not exists (select 1 from competitions where name = 'Youth Girls’ Rugby League 13s Championship' and season = '2025');

insert into competitions (name, slug, season, division, type, status)
select 'Youth President''s Cup', 'youth-president-s-cup-2024', '2024', 'youth', 'Cup', 'completed'
where not exists (select 1 from competitions where name = 'Youth President''s Cup' and season = '2024');

insert into competitions (name, slug, season, division, type, status)
select 'eRugby League', 'erugby-league-2025', '2025', 'men', 'Tournament', 'completed'
where not exists (select 1 from competitions where name = 'eRugby League' and season = '2025');


-- ── 4. Fixtures and results ─────────────────────────────────
-- Staged in a temp table so each row can be resolved against the teams,
-- venues and competitions above by name rather than by a hard-coded id.

-- Explicitly dropped at the end rather than "on commit drop", which would
-- destroy the table immediately if these statements run outside a single
-- transaction.
drop table if exists _seed_fixtures;

create temp table _seed_fixtures (
  slug   text,
  comp   text,
  season text,
  home   text,
  away   text,
  venue  text,
  played boolean,
  hs     integer,
  "as"   integer,
  dt     date
);

insert into _seed_fixtures values

  ('african-warriors-accra-panthers-10-03-24', 'Youth 13s Championship', '2024', 'African Warriors', 'Accra Panthers', 'Ajax Park', true, 4, 8, '2024-03-10'),
  ('accra-panthers-nungua-tigers-17-03-24', 'Youth 13s Championship', '2024', 'Accra Panthers', 'Nungua Tigers', 'Ajax Park', true, 18, 4, '2024-03-17'),
  ('african-warriors-nungua-tigers-24-03-24', 'Youth 13s Championship', '2024', 'African Warriors', 'Nungua Tigers', 'Ajax Park', true, 40, 4, '2024-03-24'),
  ('accra-panthers-african-warriors-07-04-24', 'Youth 13s Championship', '2024', 'Accra Panthers', 'African Warriors', 'Ajax Park', true, 0, 22, '2024-04-07'),
  ('african-warriors-skolars-14-04-24', 'Youth 13s Championship', '2024', 'African Warriors', 'Skolars', 'Ajax Park', true, 12, 0, '2024-04-14'),
  ('accra-panthers-nungua-tigers-14-04-24', 'Youth 13s Championship', '2024', 'Accra Panthers', 'Nungua Tigers', 'Ajax Park', true, 14, 16, '2024-04-14'),
  ('nungua-tigers-skolars-21-04-24', 'Youth 13s Championship', '2024', 'Nungua Tigers', 'Skolars', 'Ajax Park', true, 0, 4, '2024-04-21'),
  ('skolars-african-warriors-28-04-24', 'Youth 13s Championship', '2024', 'Skolars', 'African Warriors', 'Ajax Park', true, 0, 6, '2024-04-28'),
  ('nungua-tigers-african-warriors-05-05-24', 'Youth 13s Championship', '2024', 'Nungua Tigers', 'African Warriors', 'Ajax Park', true, 12, 26, '2024-05-05'),
  ('accra-panthers-skolars-19-05-24', 'Youth 13s Championship', '2024', 'Accra Panthers', 'Skolars', 'Ajax Park', true, 4, 4, '2024-05-19'),
  ('skolars-accra-panthers-26-05-24', 'Youth 13s Championship', '2024', 'Skolars', 'Accra Panthers', 'Wembley Park', true, 0, 16, '2024-05-26'),
  ('skolars-nungua-tigers-21-07-24', 'Youth 13s Championship', '2024', 'Skolars', 'Nungua Tigers', 'Wembley Park', true, 10, 0, '2024-07-21'),
  ('bulls-titans-06-10-24', 'Men''s 9s Championship', '2024', 'Bulls', 'Titans', 'University of Ghana Rugby Stadium', true, 29, 0, '2024-10-06'),
  ('skolars-accra-panthers-06-10-24', 'Men''s 9s Championship', '2024', 'Skolars', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 22, 4, '2024-10-06'),
  ('nungua-tigers-accra-majestics-06-10-24', 'Men''s 9s Championship', '2024', 'Nungua Tigers', 'Accra Majestics', 'University of Ghana Rugby Stadium', true, 12, 0, '2024-10-06'),
  ('titans-skolars-06-10-24', 'Men''s 9s Championship', '2024', 'Titans', 'Skolars', 'University of Ghana Rugby Stadium', true, 0, 24, '2024-10-06'),
  ('accra-majestics-accra-panthers-06-10-24', 'Men''s 9s Championship', '2024', 'Accra Majestics', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 0, 4, '2024-10-06'),
  ('nungua-tigers-bulls-06-10-24', 'Men''s 9s Championship', '2024', 'Nungua Tigers', 'Bulls', 'University of Ghana Rugby Stadium', true, 27, 12, '2024-10-06'),
  ('skolars-accra-majestics-06-10-24', 'Men''s 9s Championship', '2024', 'Skolars', 'Accra Majestics', 'University of Ghana Rugby Stadium', true, 15, 0, '2024-10-06'),
  ('titans-nungua-tigers-06-10-24', 'Men''s 9s Championship', '2024', 'Titans', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 0, 30, '2024-10-06'),
  ('accra-panthers-bulls-06-10-24', 'Men''s 9s Championship', '2024', 'Accra Panthers', 'Bulls', 'University of Ghana Rugby Stadium', true, 4, 4, '2024-10-06'),
  ('nungua-tigers-skolars-06-10-24', 'Men''s 9s Championship', '2024', 'Nungua Tigers', 'Skolars', 'University of Ghana Rugby Stadium', true, 0, 13, '2024-10-06'),
  ('bulls-accra-majestics-06-10-24', 'Men''s 9s Championship', '2024', 'Bulls', 'Accra Majestics', 'University of Ghana Rugby Stadium', true, 20, 4, '2024-10-06'),
  ('titans-accra-panthers-13-10-24', 'Men''s 9s Championship', '2024', 'Titans', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 0, 30, '2024-10-13'),
  ('nungua-tigers-accra-panthers-13-10-24', 'Men''s 9s Championship', '2024', 'Nungua Tigers', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 14, 0, '2024-10-13'),
  ('accra-majestics-titans-13-10-24', 'Men''s 9s Championship', '2024', 'Accra Majestics', 'Titans', 'University of Ghana Rugby Stadium', true, 9, 4, '2024-10-13'),
  ('skolars-bulls-13-10-24', 'Men''s 9s Championship', '2024', 'Skolars', 'Bulls', 'University of Ghana Rugby Stadium', true, 21, 11, '2024-10-13'),
  ('titans-bulls-13-10-24', 'Men''s 9s Championship', '2024', 'Titans', 'Bulls', 'University of Ghana Rugby Stadium', true, 0, 30, '2024-10-13'),
  ('accra-majestics-nungua-tigers-13-10-24', 'Men''s 9s Championship', '2024', 'Accra Majestics', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 4, 22, '2024-10-13'),
  ('accra-panthers-bulls-13-10-24', 'Women''s 9s Championship', '2024', 'Accra Panthers', 'Bulls', 'University of Ghana Rugby Stadium', true, 12, 4, '2024-10-13'),
  ('accra-majestics-nungua-tigers-13-10-24-2', 'Women''s 9s Championship', '2024', 'Accra Majestics', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 0, 16, '2024-10-13'),
  ('nungua-tigers-accra-panthers-13-10-24-2', 'Women''s 9s Championship', '2024', 'Nungua Tigers', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 9, 8, '2024-10-13'),
  ('accra-majestics-bulls-13-10-24', 'Women''s 9s Championship', '2024', 'Accra Majestics', 'Bulls', 'University of Ghana Rugby Stadium', true, 0, 13, '2024-10-13'),
  ('nungua-tigers-accra-majestics-13-10-24', 'Youth 9s Championship', '2024', 'Nungua Tigers', 'Accra Majestics', 'University of Ghana Rugby Stadium', true, 7, 25, '2024-10-13'),
  ('accra-majestics-accra-panthers-13-10-24', 'Youth 9s Championship', '2024', 'Accra Majestics', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 4, 14, '2024-10-13'),
  ('accra-panthers-nungua-tigers-13-10-24', 'Youth 9s Championship', '2024', 'Accra Panthers', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 13, 4, '2024-10-13'),
  ('accra-panthers-skolars-20-10-24', 'Men''s 9s Championship', '2024', 'Accra Panthers', 'Skolars', 'Sarbah Field', true, 4, 19, '2024-10-20'),
  ('skolars-titans-20-10-24', 'Men''s 9s Championship', '2024', 'Skolars', 'Titans', 'Sarbah Field', true, 30, 0, '2024-10-20'),
  ('accra-panthers-accra-majestics-20-10-24', 'Men''s 9s Championship', '2024', 'Accra Panthers', 'Accra Majestics', 'Sarbah Field', true, 0, 0, '2024-10-20'),
  ('bulls-nungua-tigers-20-10-24', 'Men''s 9s Championship', '2024', 'Bulls', 'Nungua Tigers', 'Sarbah Field', true, 11, 11, '2024-10-20'),
  ('accra-majestics-skolars-20-10-24', 'Men''s 9s Championship', '2024', 'Accra Majestics', 'Skolars', 'Sarbah Field', true, 6, 12, '2024-10-20'),
  ('nungua-tigers-titans-20-10-24', 'Men''s 9s Championship', '2024', 'Nungua Tigers', 'Titans', 'Sarbah Field', true, 30, 0, '2024-10-20'),
  ('bulls-accra-panthers-20-10-24', 'Men''s 9s Championship', '2024', 'Bulls', 'Accra Panthers', 'Sarbah Field', true, 8, 10, '2024-10-20'),
  ('skolars-nungua-tigers-20-10-24', 'Men''s 9s Championship', '2024', 'Skolars', 'Nungua Tigers', 'Sarbah Field', true, 10, 0, '2024-10-20'),
  ('accra-majestics-bulls-20-10-24', 'Men''s 9s Championship', '2024', 'Accra Majestics', 'Bulls', 'Sarbah Field', true, 0, 15, '2024-10-20'),
  ('titans-accra-panthers-20-10-24', 'Men''s 9s Championship', '2024', 'Titans', 'Accra Panthers', 'Sarbah Field', true, 0, 30, '2024-10-20'),
  ('accra-panthers-accra-majestics-20-10-24-2', 'Women''s 9s Championship', '2024', 'Accra Panthers', 'Accra Majestics', 'Sarbah Field', true, 12, 0, '2024-10-20'),
  ('bulls-nungua-tigers-20-10-24-2', 'Women''s 9s Championship', '2024', 'Bulls', 'Nungua Tigers', 'Sarbah Field', true, 5, 4, '2024-10-20'),
  ('accra-panthers-nungua-tigers-27-10-24', 'Men''s 9s Championship', '2024', 'Accra Panthers', 'Nungua Tigers', 'Sarbah Field', true, 7, 10, '2024-10-27'),
  ('titans-accra-majestics-27-10-24', 'Men''s 9s Championship', '2024', 'Titans', 'Accra Majestics', 'Sarbah Field', true, 0, 4, '2024-10-27'),
  ('bulls-skolars-27-10-24', 'Men''s 9s Championship', '2024', 'Bulls', 'Skolars', 'Sarbah Field', true, 0, 30, '2024-10-27'),
  ('accra-majestics-nungua-tigers-27-10-24', 'Youth 9s Championship', '2024', 'Accra Majestics', 'Nungua Tigers', 'Sarbah Field', true, 8, 0, '2024-10-27'),
  ('nungua-tigers-bulls-27-10-24', 'Women''s 9s Championship', '2024', 'Nungua Tigers', 'Bulls', 'Sarbah Field', true, 8, 4, '2024-10-27'),
  ('nungua-tigers-bulls-27-10-24-2', 'Men''s 9s Championship', '2024', 'Nungua Tigers', 'Bulls', 'Sarbah Field', true, 34, 4, '2024-10-27'),
  ('accra-panthers-accra-majestics-27-10-24', 'Youth 9s Championship', '2024', 'Accra Panthers', 'Accra Majestics', 'Sarbah Field', true, 12, 0, '2024-10-27'),
  ('accra-panthers-nungua-tigers-27-10-24-2', 'Women''s 9s Championship', '2024', 'Accra Panthers', 'Nungua Tigers', 'Sarbah Field', true, 12, 0, '2024-10-27'),
  ('skolars-nungua-tigers-27-10-24', 'Men''s 9s Championship', '2024', 'Skolars', 'Nungua Tigers', 'Sarbah Field', true, 10, 13, '2024-10-27'),
  ('men-national-team-men-president-xiii-24-11-24', 'Men''s President''s Cup', '2024', 'Men National Team', 'Men President XIII', 'University of Ghana Rugby Stadium', true, 18, 20, '2024-11-24'),
  ('women-national-team-women-president-xiii-24-11-24', 'Women''s President''s Cup', '2024', 'Women National Team', 'Women President XIII', 'University of Ghana Rugby Stadium', true, 22, 12, '2024-11-24'),
  ('national-youth-team-youth-president-xiii-24-11-24', 'Youth President''s Cup', '2024', 'National Youth Team', 'Youth President XIII', 'University of Ghana Rugby Stadium', true, 26, 6, '2024-11-24'),
  ('bulls-accra-panthers-31-08-25', 'eRugby League', '2025', 'Bulls', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 6, 6, '2025-08-31'),
  ('skolars-nungua-tigers-31-08-25', 'eRugby League', '2025', 'Skolars', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 0, 0, '2025-08-31'),
  ('dragons-titans-31-08-25', 'eRugby League', '2025', 'Dragons', 'Titans', 'University of Ghana Rugby Stadium', true, 6, 0, '2025-08-31'),
  ('accra-panthers-skolars-31-08-25', 'eRugby League', '2025', 'Accra Panthers', 'Skolars', 'University of Ghana Rugby Stadium', true, 4, 1, '2025-08-31'),
  ('titans-nungua-tigers-31-08-25', 'eRugby League', '2025', 'Titans', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 7, 0, '2025-08-31'),
  ('dragons-bulls-31-08-25', 'eRugby League', '2025', 'Dragons', 'Bulls', 'University of Ghana Rugby Stadium', true, 15, 0, '2025-08-31'),
  ('skolars-titans-31-08-25', 'eRugby League', '2025', 'Skolars', 'Titans', 'University of Ghana Rugby Stadium', true, 0, 0, '2025-08-31'),
  ('accra-panthers-dragons-31-08-25', 'eRugby League', '2025', 'Accra Panthers', 'Dragons', 'University of Ghana Rugby Stadium', true, 0, 4, '2025-08-31'),
  ('nungua-tigers-bulls-31-08-25', 'eRugby League', '2025', 'Nungua Tigers', 'Bulls', 'University of Ghana Rugby Stadium', true, 15, 0, '2025-08-31'),
  ('dragons-skolars-07-09-25', 'eRugby League', '2025', 'Dragons', 'Skolars', 'University of Ghana Rugby Stadium', true, 6, 12, '2025-09-07'),
  ('bulls-titans-07-09-25', 'eRugby League', '2025', 'Bulls', 'Titans', 'University of Ghana Rugby Stadium', true, 0, 0, '2025-09-07'),
  ('nungua-tigers-accra-panthers-07-09-25', 'eRugby League', '2025', 'Nungua Tigers', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 0, 10, '2025-09-07'),
  ('skolars-bulls-07-09-25', 'eRugby League', '2025', 'Skolars', 'Bulls', 'University of Ghana Rugby Stadium', true, 0, 0, '2025-09-07'),
  ('dragons-nungua-tigers-07-09-25', 'eRugby League', '2025', 'Dragons', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 15, 0, '2025-09-07'),
  ('titans-accra-panthers-07-09-25', 'eRugby League', '2025', 'Titans', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 12, 12, '2025-09-07'),
  ('nungua-tigers-skolars-07-09-25', 'eRugby League', '2025', 'Nungua Tigers', 'Skolars', 'University of Ghana Rugby Stadium', true, 0, 15, '2025-09-07'),
  ('accra-panthers-bulls-07-09-25', 'eRugby League', '2025', 'Accra Panthers', 'Bulls', 'University of Ghana Rugby Stadium', true, 0, 24, '2025-09-07'),
  ('titans-dragons-07-09-25', 'eRugby League', '2025', 'Titans', 'Dragons', 'University of Ghana Rugby Stadium', true, 16, 4, '2025-09-07'),
  ('skolars-accra-panthers-07-09-25', 'eRugby League', '2025', 'Skolars', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 0, 10, '2025-09-07'),
  ('nungua-tigers-titans-14-09-25', 'eRugby League', '2025', 'Nungua Tigers', 'Titans', 'University of Ghana Rugby Stadium', true, 0, 4, '2025-09-14'),
  ('bulls-dragons-14-09-25', 'eRugby League', '2025', 'Bulls', 'Dragons', 'University of Ghana Rugby Stadium', true, 0, 15, '2025-09-14'),
  ('titans-skolars-14-09-25', 'eRugby League', '2025', 'Titans', 'Skolars', 'University of Ghana Rugby Stadium', true, 6, 0, '2025-09-14'),
  ('dragons-accra-panthers-14-09-25', 'eRugby League', '2025', 'Dragons', 'Accra Panthers', 'University of Ghana Rugby Stadium', true, 0, 0, '2025-09-14'),
  ('bulls-nungua-tigers-14-09-25', 'eRugby League', '2025', 'Bulls', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 15, 0, '2025-09-14'),
  ('skolars-dragons-14-09-25', 'eRugby League', '2025', 'Skolars', 'Dragons', 'University of Ghana Rugby Stadium', true, 18, 12, '2025-09-14'),
  ('titans-bulls-14-09-25', 'eRugby League', '2025', 'Titans', 'Bulls', 'University of Ghana Rugby Stadium', true, 15, 0, '2025-09-14'),
  ('accra-panthers-nungua-tigers-14-09-25', 'eRugby League', '2025', 'Accra Panthers', 'Nungua Tigers', 'University of Ghana Rugby Stadium', true, 15, 0, '2025-09-14'),
  ('nungua-tigers-dragons-14-09-25', 'eRugby League', '2025', 'Nungua Tigers', 'Dragons', 'University of Ghana Rugby Stadium', true, 0, 15, '2025-09-14'),
  ('bulls-skolars-14-09-25', 'eRugby League', '2025', 'Bulls', 'Skolars', 'University of Ghana Rugby Stadium', true, 0, 15, '2025-09-14'),
  ('accra-panthers-titans-14-09-25', 'eRugby League', '2025', 'Accra Panthers', 'Titans', 'University of Ghana Rugby Stadium', true, 6, 0, '2025-09-14'),
  ('accra-panthers-titans-14-09-25-2', 'eRugby League', '2025', 'Accra Panthers', 'Titans', 'University of Ghana Rugby Stadium', true, 6, 4, '2025-09-14'),
  ('accra-panthers-dragons-14-09-25', 'eRugby League', '2025', 'Accra Panthers', 'Dragons', 'University of Ghana Rugby Stadium', true, 8, 0, '2025-09-14'),
  ('skolars-nungua-tigers-05-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Skolars', 'Nungua Tigers', 'Prempeh College School Park', true, 14, 0, '2025-09-05'),
  ('bulls-accra-panthers-05-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Bulls', 'Accra Panthers', 'Prempeh College School Park', true, 0, 14, '2025-09-05'),
  ('nungua-tigers-skolars-05-09-25', 'Youth 13s Championship', '2025', 'Nungua Tigers', 'Skolars', 'Prempeh College School Park', true, 2, 8, '2025-09-05'),
  ('accra-panthers-bulls-05-09-25', 'Youth 13s Championship', '2025', 'Accra Panthers', 'Bulls', 'Prempeh College School Park', true, 4, 6, '2025-09-05'),
  ('accra-panthers-skolars-12-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Accra Panthers', 'Skolars', 'Prempeh College School Park', true, 0, 4, '2025-09-12'),
  ('bulls-nungua-tigers-12-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Bulls', 'Nungua Tigers', 'Prempeh College School Park', true, 4, 4, '2025-09-12'),
  ('accra-panthers-skolars-12-09-25-2', 'Youth 13s Championship', '2025', 'Accra Panthers', 'Skolars', 'Prempeh College School Park', true, 6, 8, '2025-09-12'),
  ('bulls-nungua-tigers-12-09-25-2', 'Youth 13s Championship', '2025', 'Bulls', 'Nungua Tigers', 'Prempeh College School Park', true, 0, 22, '2025-09-12'),
  ('skolars-bulls-23-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Skolars', 'Bulls', 'Prempeh College School Park', true, 4, 4, '2025-09-23'),
  ('accra-panthers-nungua-tigers-23-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Accra Panthers', 'Nungua Tigers', 'Prempeh College School Park', true, 0, 4, '2025-09-23'),
  ('bulls-skolars-23-09-25', 'Youth 13s Championship', '2025', 'Bulls', 'Skolars', 'Prempeh College School Park', true, 0, 4, '2025-09-23'),
  ('nungua-tigers-accra-panthers-23-09-25', 'Youth 13s Championship', '2025', 'Nungua Tigers', 'Accra Panthers', 'Prempeh College School Park', true, 6, 0, '2025-09-23'),
  ('nungua-tigers-skolars-16-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Nungua Tigers', 'Skolars', 'Prempeh College School Park', true, 0, 8, '2025-09-16'),
  ('accra-panthers-bulls-16-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Accra Panthers', 'Bulls', 'Prempeh College School Park', true, 8, 0, '2025-09-16'),
  ('skolars-nungua-tigers-16-09-25', 'Youth 13s Championship', '2025', 'Skolars', 'Nungua Tigers', 'Prempeh College School Park', true, 4, 2, '2025-09-16'),
  ('bulls-accra-panthers-16-09-25', 'Youth 13s Championship', '2025', 'Bulls', 'Accra Panthers', 'Prempeh College School Park', true, 6, 0, '2025-09-16'),
  ('skolars-accra-panthers-09-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Skolars', 'Accra Panthers', 'Prempeh College School Park', true, 0, 0, '2025-09-09'),
  ('nungua-tigers-bulls-09-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Nungua Tigers', 'Bulls', 'Prempeh College School Park', true, 4, 0, '2025-09-09'),
  ('skolars-accra-panthers-09-09-25-2', 'Youth 13s Championship', '2025', 'Skolars', 'Accra Panthers', 'Prempeh College School Park', true, 4, 0, '2025-09-09'),
  ('nungua-tigers-bulls-09-09-25-2', 'Youth 13s Championship', '2025', 'Nungua Tigers', 'Bulls', 'Prempeh College School Park', true, 6, 0, '2025-09-09'),
  ('bulls-skolars-26-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Bulls', 'Skolars', 'Prempeh College School Park', true, 4, 10, '2025-09-26'),
  ('nungua-tigers-accra-panthers-26-09-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Nungua Tigers', 'Accra Panthers', 'Prempeh College School Park', true, 4, 4, '2025-09-26'),
  ('skolars-bulls-26-09-25', 'Youth 13s Championship', '2025', 'Skolars', 'Bulls', 'Prempeh College School Park', true, 8, 0, '2025-09-26'),
  ('accra-panthers-nungua-tigers-26-09-25', 'Youth 13s Championship', '2025', 'Accra Panthers', 'Nungua Tigers', 'Prempeh College School Park', true, 8, 6, '2025-09-26'),
  ('skolars-accra-panthers-03-10-25', 'Youth Girls’ Rugby League 13s Championship', '2025', 'Skolars', 'Accra Panthers', 'Prempeh College School Park', true, 10, 4, '2025-10-03'),
  ('skolars-nungua-tigers-03-10-25', 'Youth 13s Championship', '2025', 'Skolars', 'Nungua Tigers', 'Prempeh College School Park', true, 10, 0, '2025-10-03');


insert into fixtures (competition_id, home_team_id, away_team_id, venue_id, scheduled_date, status, slug)
select
  c.competition_id,
  h.team_id,
  a.team_id,
  v.venue_id,
  s.dt,
  case when s.played then 'completed' else 'scheduled' end,
  s.slug
from _seed_fixtures s
join competitions c on c.name = s.comp and c.season = s.season
join teams h on h.name = s.home
join teams a on a.name = s.away
left join venues v on v.name = s.venue
where not exists (select 1 from fixtures f where f.slug = s.slug);

insert into match_results (fixture_id, home_score, away_score)
select f.fixture_id, s.hs, s."as"
from _seed_fixtures s
join fixtures f on f.slug = s.slug
where s.played
  and s.hs is not null
  and not exists (select 1 from match_results r where r.fixture_id = f.fixture_id);

drop table _seed_fixtures;
