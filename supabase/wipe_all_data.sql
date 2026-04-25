-- ============================================================
-- FULL DATA WIPE — clears all rows, keeps schema intact.
-- Run in Supabase SQL editor.
-- Order respects foreign key constraints.
-- ============================================================

-- 1. Match-level data
delete from match_events;
delete from match_lineups;
delete from fixture_officials;
delete from match_results;

-- 2. Suspensions
delete from suspensions;

-- 3. Fixtures
delete from fixtures;

-- 4. Player registrations
delete from player_registrations;

-- 5. Players
delete from players;

-- 6. Competitions
delete from competitions;

-- 7. Teams
delete from teams;

-- 8. Venues
delete from venues;

-- 9. Officials
delete from officials;

-- Verify everything is empty
select 'players'              as tbl, count(*) from players
union all select 'teams',               count(*) from teams
union all select 'fixtures',            count(*) from fixtures
union all select 'match_results',       count(*) from match_results
union all select 'match_events',        count(*) from match_events
union all select 'competitions',        count(*) from competitions
union all select 'venues',              count(*) from venues
union all select 'officials',           count(*) from officials
union all select 'player_registrations',count(*) from player_registrations
union all select 'suspensions',         count(*) from suspensions;
