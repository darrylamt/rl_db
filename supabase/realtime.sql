-- ============================================================
-- Enable Supabase Realtime for live-updating tables.
-- Run this once in the SQL editor AFTER schema.sql.
-- Idempotent: safe to re-run.
-- ============================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'match_events',
    'match_results',
    'fixtures',
    'teams',
    'players',
    'officials',
    'competitions',
    'suspensions'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end$$;
