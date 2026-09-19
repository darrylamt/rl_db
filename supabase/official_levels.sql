-- ============================================================
-- What level a match official has reached.
--
-- Officials go on courses and move up. That progression is part of who they
-- are — it decides which matches they can be put on — and there was nowhere
-- to write it down.
--
-- Two columns, both set by hand in the admin. Nothing infers a level from
-- matches refereed: passing a course is a thing that happens off the field
-- and only the federation knows when it did.
--
--   level         where they are now
--   level_gained  when they got there, so "promoted last month" is on record
--
-- The levels themselves are deliberately free text rather than a check
-- constraint. The federation's own ladder is still settling, and a
-- constraint here would mean a migration every time a course is renamed.
-- The admin offers the usual ones as a list and accepts anything.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table officials add column if not exists level text;
alter table officials add column if not exists level_gained date;

comment on column officials.level is
  'Refereeing level reached. Set by hand — never inferred from matches done.';
comment on column officials.level_gained is
  'When that level was awarded.';

create index if not exists idx_officials_level
  on officials(level) where level is not null;

-- ── The public view ─────────────────────────────────────────
-- Level is public: it is a qualification, like a coach's. Phone and email
-- stay off, which is the whole reason this view exists.
--
-- date_of_birth and age come off it here too. Ages were taken off the public
-- side for players and officials were missed — this view was still handing
-- out both, and the public official page is new enough that nothing has ever
-- shown them.
drop view if exists public_officials;

create view public_officials
  with (security_invoker = true)
as
select
  official_id,
  first_name,
  last_name,
  role,
  level,
  level_gained,
  region,
  nationality,
  photo_url,
  status,
  created_at
from officials;

grant select on public_officials to anon, authenticated;

-- ── What is on record ───────────────────────────────────────
select
  first_name || ' ' || last_name as official,
  role,
  coalesce(level, '— not set —') as level,
  level_gained,
  status
from officials
order by last_name;

-- And that no age reaches the public view any more.
select
  bool_or(column_name = 'level')         as has_level,
  bool_or(column_name = 'date_of_birth') as still_has_dob,
  bool_or(column_name = 'age')           as still_has_age
from information_schema.columns
where table_schema = 'public' and table_name = 'public_officials';
