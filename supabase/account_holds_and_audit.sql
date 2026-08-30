-- ============================================================
-- Accounts that can be put on hold, and a record of who did what.
--
-- Two things the admin could not do.
--
-- A club's login has to exist before the season starts so they can enter a
-- squad, but it should not work until they have paid their registration.
-- Deleting and re-creating the account loses the password already handed
-- over and everything the account has done. A hold is the honest shape: the
-- account stays, the sign-in stops.
--
-- And nothing recorded who issued a login, who revoked one, or who approved
-- a player. With clubs and recorders now writing to the database, "who
-- changed this" stops being answerable from memory.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── 1. Holds ────────────────────────────────────────────────
alter table app_users
  add column if not exists status text not null default 'active';

alter table app_users drop constraint if exists app_users_status_check;
alter table app_users
  add constraint app_users_status_check check (status in ('active', 'on_hold'));

alter table app_users add column if not exists held_reason text;
alter table app_users add column if not exists held_at timestamptz;

comment on column app_users.status is
  'active, or on_hold — the account exists and keeps its password but cannot sign in.';

-- A held account must not pass the match-writing check either. Recorders on
-- hold stop writing the moment the hold goes on, not at their next sign-in.
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
      and status = 'active'
  );
$$;

-- ── 2. Audit trail ──────────────────────────────────────────
create table if not exists audit_log (
  entry_id    uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  -- Kept as plain columns rather than a foreign key: the record has to
  -- survive the account it describes being deleted, which is exactly the
  -- case you most want to look back on.
  actor_id    uuid,
  actor_email text,
  actor_role  text,
  action      text not null,
  entity      text,
  entity_id   text,
  summary     text,
  detail      jsonb
);

create index if not exists idx_audit_log_at on audit_log(at desc);
create index if not exists idx_audit_log_entity on audit_log(entity, entity_id);
create index if not exists idx_audit_log_actor on audit_log(actor_id);

-- No policy is deliberate. RLS on with no policy denies every anon and
-- authenticated client outright; the admin reads and writes it with the
-- service key, which bypasses RLS. An audit trail a client could edit would
-- not be worth keeping.
alter table audit_log enable row level security;

-- ── 3. What the accounts look like now ──────────────────────
select role, status, email from app_users order by role, email;
