-- ============================================================
-- Remove three SELECT policies that duplicate what was already there.
--
-- enter_write_policies.sql re-asserted anonymous read access so the public
-- live pages could not go blank. It looked for a policy naming the anon role
-- and did not find one — because the existing policies name public, which
-- already includes anon. So it added a second policy saying the same thing.
--
-- Policies are OR'd, so nothing broke; there is simply one more rule than the
-- read needs. This drops the additions and leaves the originals.
--
-- Optional and cosmetic. Safe to re-run.
-- ============================================================

drop policy if exists anon_select_match_events  on public.match_events;
drop policy if exists anon_select_match_results on public.match_results;
drop policy if exists anon_select_fixtures      on public.fixtures;

-- Prove the public can still read, which is the only thing that matters here.
select tablename, policyname, cmd, array_to_string(roles, ',') as roles
from pg_policies
where schemaname = 'public'
  and tablename in ('match_events', 'match_results', 'fixtures')
  and cmd = 'SELECT'
order by tablename;
