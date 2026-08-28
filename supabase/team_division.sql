-- ============================================================
-- Team division: men / women / youth.
--
-- competitions already carries a division column (added by
-- migration_category_and_history.sql), but teams does not — and the public
-- website's club listing has a men/women/youth toggle that filters on
-- exactly this. Without it, a club can only exist once, so the women's and
-- youth sides have nowhere to live.
--
-- team_type stays what it is (club / national / president_xv). The two
-- describe different things: what kind of entity a team is, versus which
-- division it plays in.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table teams
  add column if not exists division text default 'men';

update teams set division = 'men' where division is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teams_division_check') then
    alter table teams add constraint teams_division_check
      check (division in ('men', 'women', 'youth'));
  end if;
end$$;

create index if not exists teams_division_idx on teams (division, name);
