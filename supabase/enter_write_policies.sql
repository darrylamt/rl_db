-- ============================================================
-- Let a signed-in official record a match from any device.
--
-- The quick-entry screens under /enter write straight from the browser, so
-- the database policies are what decide whether a write lands — not the app.
--
-- Enabling RLS on match_events with INSERT and SELECT for authenticated was
-- right, and it closed a real hole: those tables previously carried policies
-- named "public insert match_events" and the like, which let anyone who
-- opened the page — signed in or not — write to them. The anon key ships in
-- the browser bundle, so that was open to anyone who looked.
--
-- Two things were missed, and both bite in ordinary use:
--
--   /enter/result upserts match_results, and an upsert onto an existing row
--   is an UPDATE. With no update policy, correcting a score fails while
--   entering one for the first time works.
--
--   /enter/result also marks the fixture completed, which is an UPDATE on
--   fixtures, and /enter/fixture INSERTs one.
--
-- Deleting an event is included so a mistyped try can be taken back.
--
-- Every policy here is for authenticated only. Anonymous visitors keep their
-- read access and get no writes.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('match_events',  'update'),
      ('match_events',  'delete'),
      ('match_results', 'insert'),
      ('match_results', 'update'),
      ('fixtures',      'insert'),
      ('fixtures',      'update')
    ) as t(tbl, op)
  loop
    execute format('alter table public.%I enable row level security', spec.tbl);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = spec.tbl
        and policyname = format('authenticated_%s_%s', spec.op, spec.tbl)
    ) then
      if spec.op = 'insert' then
        execute format(
          'create policy %I on public.%I for insert to authenticated with check (true)',
          format('authenticated_%s_%s', spec.op, spec.tbl), spec.tbl);
      elsif spec.op = 'update' then
        execute format(
          'create policy %I on public.%I for update to authenticated using (true) with check (true)',
          format('authenticated_%s_%s', spec.op, spec.tbl), spec.tbl);
      else
        execute format(
          'create policy %I on public.%I for delete to authenticated using (true)',
          format('authenticated_%s_%s', spec.op, spec.tbl), spec.tbl);
      end if;
    end if;
  end loop;
end $$;

-- Anonymous visitors must still be able to read, or the public live pages go
-- blank. Added only where it is missing.
do $$
declare
  t text;
begin
  foreach t in array array['match_events', 'match_results', 'fixtures']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t
        and cmd = 'SELECT' and 'anon' = any(roles)
    ) then
      execute format(
        'create policy %I on public.%I for select to anon using (true)',
        format('anon_select_%s', t), t);
    end if;
  end loop;
end $$;

-- What now applies, to check against.
select tablename, policyname, cmd, array_to_string(roles, ',') as roles
from pg_policies
where schemaname = 'public'
  and tablename in ('match_events', 'match_results', 'fixtures')
order by tablename, cmd, policyname;
