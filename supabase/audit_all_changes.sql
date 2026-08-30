-- ============================================================
-- Audit every change, whoever made it.
--
-- The first pass recorded what the admin's own code chose to record. That
-- misses the half that matters most: /enter writes to match_events and
-- match_results straight from the browser, and the club portal writes to
-- players. None of that goes through code that could file a note.
--
-- So the database records it instead. A trigger cannot be gone around — a
-- write from the admin, from a phone at a ground, from the club portal or
-- from the SQL editor all land the same way, with auth.uid() saying who.
--
-- Run AFTER account_holds_and_audit.sql. Safe to re-run.
-- ============================================================

-- ── The recorder ────────────────────────────────────────────
-- security definer so it can write to audit_log, which is closed to every
-- client on purpose. TG_ARGV[0] is the table's primary key column, passed in
-- when the trigger is created below.
create or replace function public.audit_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor       uuid := auth.uid();
  actor_email text;
  actor_role  text;
  row_id      text;
  new_j       jsonb := case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end;
  old_j       jsonb := case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end;
  line        text;
begin
  select u.email, u.role into actor_email, actor_role
  from app_users u where u.user_id = actor;

  row_id := coalesce(new_j, old_j) ->> TG_ARGV[0];

  -- app_users is the one table worth describing in words, because "who was
  -- given access, and who took it away" is the question this table is asked.
  if TG_TABLE_NAME = 'app_users' then
    line := case
      when TG_OP = 'INSERT' then
        'Issued a ' || (new_j ->> 'role') || ' login to ' || coalesce(new_j ->> 'email', 'an account')
      when TG_OP = 'DELETE' then
        'Revoked the ' || (old_j ->> 'role') || ' login ' || coalesce(old_j ->> 'email', '')
      when (old_j ->> 'status') is distinct from (new_j ->> 'status') then
        case when new_j ->> 'status' = 'on_hold'
             then 'Put ' || coalesce(new_j ->> 'email', 'an account') || ' on hold'
             else 'Released ' || coalesce(new_j ->> 'email', 'an account') || ' from hold' end
      else
        'Changed the login ' || coalesce(new_j ->> 'email', '')
    end;
  else
    line := null;
  end if;

  insert into audit_log (
    actor_id, actor_email, actor_role, action, entity, entity_id, summary, detail
  ) values (
    actor,
    actor_email,
    -- No auth.uid() means the service key or the SQL editor: a migration or
    -- the admin's own server code, not a person signing in.
    coalesce(actor_role, case when actor is null then 'system' else 'unprovisioned' end),
    TG_TABLE_NAME || '.' || lower(TG_OP),
    TG_TABLE_NAME,
    row_id,
    line,
    -- Only what changed, so an update does not carry the whole row twice.
    case
      when TG_OP = 'UPDATE' then jsonb_build_object(
        'changed',
        (select jsonb_object_agg(k, jsonb_build_array(old_j -> k, new_j -> k))
         from jsonb_object_keys(new_j) k
         where old_j -> k is distinct from new_j -> k)
      )
      when TG_OP = 'INSERT' then jsonb_build_object('new', new_j)
      else jsonb_build_object('old', old_j)
    end
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end $$;

-- ── Attach it ───────────────────────────────────────────────
-- The tables where "who changed this" is a real question. Read-only
-- reference tables are left out; so is audit_log itself, which must not
-- record its own writes.
do $$
declare
  t  text;
  pk text;
begin
  foreach t in array array[
    'app_users', 'match_events', 'match_results', 'match_lineups',
    'match_player_ratings', 'fixtures', 'players', 'teams',
    'player_registrations', 'player_history', 'suspensions',
    'competitions', 'venues', 'officials', 'fixture_officials',
    'articles', 'documents', 'people', 'partners'
  ]
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'skipping %, no such table', t;
      continue;
    end if;

    -- The primary key column, so the entry points at a row.
    select a.attname into pk
    from pg_index i
    join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    where i.indrelid = ('public.' || t)::regclass and i.indisprimary
    limit 1;

    execute format('drop trigger if exists audit_%1$s on public.%1$I', t);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$I
         for each row execute function public.audit_change(%2$L)',
      t, pk
    );
  end loop;
end $$;

-- ── What is now watched ─────────────────────────────────────
select event_object_table as table_name, trigger_name
from information_schema.triggers
where trigger_schema = 'public' and trigger_name like 'audit_%'
order by event_object_table;
