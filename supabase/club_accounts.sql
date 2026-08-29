-- ============================================================
-- Club accounts, and the roles that make them safe.
--
-- Until now the admin has been gated on being signed in, nothing more: any
-- account that could log in had the whole federation's data. That was
-- workable while the only accounts were the federation's own. It stops being
-- workable the moment clubs get logins of their own.
--
-- app_users says what an account is. A federation account keeps the admin. A
-- club account is tied to one club and can only ever see and touch that club.
--
-- Every account that exists today is recorded as federation, so nobody is
-- locked out by this running.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists app_users (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role       text not null check (role in ('federation', 'club')),
  -- Which club this account speaks for. Federation accounts have none.
  team_id    uuid references teams(team_id) on delete cascade,
  email      text,
  created_at timestamptz default now(),
  constraint club_account_needs_a_club
    check (role <> 'club' or team_id is not null)
);

create index if not exists idx_app_users_team on app_users(team_id);

-- ── Nobody is locked out by this ────────────────────────────
-- Everyone who can already log in is the federation.
insert into app_users (user_id, role, email)
select u.id, 'federation', u.email
from auth.users u
on conflict (user_id) do nothing;

-- ── Row level security ──────────────────────────────────────
-- An account may read its own row and nothing else. Assigning roles is the
-- federation's job, done through the admin with the service key, so no
-- policy grants a write here.
alter table app_users enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'app_users' and policyname = 'app_users_read_own'
  ) then
    create policy app_users_read_own on app_users
      for select using (auth.uid() = user_id);
  end if;
end $$;
