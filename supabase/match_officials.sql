-- ============================================================
-- Who refereed it, and who ran the touch.
--
-- fixture_officials has existed since the first schema and has never held a
-- single row. The public match page reads it, the fixture delete cleans it
-- up, and nothing has ever written to it — there was no way for the
-- federation to say who was on a game. This gives the column a vocabulary and
-- an index; the form that fills it comes with the deploy.
--
-- THE ROLES
--   referee        one to a match
--   touch_judge_1  the two touch judges are separate roles rather than two
--   touch_judge_2  rows of one, so "one of each per match" is a unique index
--                  rather than something the application has to police.
--
-- Old matches are the point as much as new ones. Nothing here is tied to a
-- fixture's date or status, so a game from 2019 can have its officials
-- recorded today, and corrected tomorrow.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- Any role already on record that does not fit the vocabulary. Should be
-- empty — the table has never been written to — but a constraint that fails
-- silently on somebody else's data is worse than one that shows its working.
select role, count(*) as rows_that_would_block_the_constraint
from fixture_officials
where role is null
   or role not in ('referee', 'touch_judge_1', 'touch_judge_2')
group by role;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'fixture_officials_role_check'
  ) then
    alter table fixture_officials drop constraint fixture_officials_role_check;
  end if;

  alter table fixture_officials add constraint fixture_officials_role_check
    check (role in ('referee', 'touch_judge_1', 'touch_judge_2'));
end $$;

-- One referee and one of each touch judge per match. Saving a fixture rewrites
-- its officials, so without this a double submit is a match with two referees.
create unique index if not exists one_official_per_role_per_fixture
  on fixture_officials (fixture_id, role);

-- The public profile asks "every match this person was on", which is this
-- index read backwards.
create index if not exists idx_fixture_officials_official
  on fixture_officials (official_id);

comment on table fixture_officials is
  'Who officiated a match. One referee and up to two touch judges per fixture.';

-- ── What is on record ───────────────────────────────────────
select
  o.first_name || ' ' || o.last_name as official,
  fo.role,
  count(*)                           as matches
from fixture_officials fo
join officials o on o.official_id = fo.official_id
group by o.first_name, o.last_name, fo.role
order by matches desc;
