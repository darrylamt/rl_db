-- ============================================================
-- Line-ups and ratings update live too.
--
-- The publication carried events, results and fixtures, so a score pushed to
-- the live page on its own. Naming a squad did not: match_lineups was never
-- published, so anyone watching had to reload before a team sheet appeared.
--
-- match_player_ratings joins them, since a rating entered during a match
-- belongs on the page the moment it is given.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array['match_lineups', 'match_player_ratings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- What the live pages can now be told about, in one place.
select tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
