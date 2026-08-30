-- ============================================================
-- Match-day recorders: a login that can enter a match and nothing else.
--
-- /enter is where scores and events are typed in during a game. Until now it
-- was gated on being signed in and nothing more, so any account that could
-- log in — a club's own, for instance — could record events for any match.
-- Signed in is not the same as allowed.
--
-- This adds a third role. A recorder reaches /enter and only /enter: not the
-- admin, not a club portal. The federation keeps everything, recorders
-- included.
--
-- The public live pages are untouched. They read without signing in and must
-- keep doing so — nothing here changes a SELECT policy.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── 1. Let app_users hold the new role ──────────────────────
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users
  add constraint app_users_role_check
  check (role in ('federation', 'club', 'recorder'));

-- ── 2. One place that answers "may this account record a match?" ──
-- security definer so the check does not depend on the caller being able to
-- read app_users, and cannot be defeated by a policy change there later.
create or replace function public.is_match_recorder()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_users
    where user_id = auth.uid()
      and role in ('federation', 'recorder')
  );
$$;

revoke all on function public.is_match_recorder() from public;
grant execute on function public.is_match_recorder() to authenticated;

-- ── 3. Writes on match tables belong to recorders only ──────
-- Policies are OR'd: leaving an older "any authenticated user may insert"
-- policy in place would undo everything above, so every write policy on
-- these three tables is dropped first and replaced by the one rule. SELECT
-- policies are deliberately left alone — that is what keeps /live public.
do $$
declare
  p record;
begin
  for p in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('match_events', 'match_results', 'fixtures')
      and cmd <> 'SELECT'
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    raise notice 'dropped write policy % on %', p.policyname, p.tablename;
  end loop;
end $$;

-- for all covers insert, update and delete in one rule. Update matters:
-- /enter/result upserts a score and then marks the fixture completed, so a
-- policy that only granted insert would fail halfway through a match.
create policy recorders_write_match_events on public.match_events
  for all to authenticated
  using (public.is_match_recorder())
  with check (public.is_match_recorder());

create policy recorders_write_match_results on public.match_results
  for all to authenticated
  using (public.is_match_recorder())
  with check (public.is_match_recorder());

create policy recorders_write_fixtures on public.fixtures
  for all to authenticated
  using (public.is_match_recorder())
  with check (public.is_match_recorder());

alter table public.match_events  enable row level security;
alter table public.match_results enable row level security;
alter table public.fixtures      enable row level security;

-- ── 4. What the tables allow now ────────────────────────────
select tablename, policyname, cmd, array_to_string(roles, ',') as roles
from pg_policies
where schemaname = 'public'
  and tablename in ('match_events', 'match_results', 'fixtures')
order by tablename, cmd, policyname;
