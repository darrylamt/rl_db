-- ============================================================
-- Youth is boys and girls, and the difference matters.
--
-- "Youth" was one grade. It is two, and treating it as one had a consequence
-- nobody intended: club value counted a women's side as a thing a club either
-- had or did not, and a club running a girls youth setup got no credit for it.
--
-- Skolars are the example. They have the best playing record in the league,
-- twenty-three girls on the youth register, and thirteen fixtures entered in
-- the 2025 Youth Girls' championship — and they sat fourth on club value,
-- marked down for "fielding no women's side". They field female rugby. The
-- model could not see it.
--
-- WHAT THIS CHANGES
--   competitions.division  'youth' becomes 'youth_boys' or 'youth_girls'
--   teams.division         the same, and the check constraint widens to allow it
--
--   Players are NOT touched. Every one of the 264 youth players already has a
--   gender recorded — 177 boys, 87 girls, none missing — so a player's grade
--   is worked out from category and gender together in the code. There is
--   nothing to migrate and nothing for anybody to re-enter.
--
-- HOW COMPETITIONS ARE CLASSIFIED
--   By name, and the name is trustworthy here because the record agrees with
--   it exactly. Every youth competition that has ever been played is entirely
--   one gender — not one mixed squad among them:
--
--     Youth 13s Championship 2024        366 named, all boys
--     Youth 13s Championship 2025        459 named, all boys
--     Youth 9s Championship 2024         192 named, all boys
--     Youth President's Cup 2024          40 named, all boys
--     Youth Girls' 13s Championship 2025 426 named, all girls
--
--   The five remaining youth competitions are templates with no fixtures, so
--   there is nothing to check them against and the name is all there is. Any
--   the federation disagrees with can be changed in the admin.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

-- ── What is about to be reclassified ────────────────────────
select
  c.name,
  c.season,
  c.division                                            as before_this_runs,
  case when c.name ilike '%girls%' then 'youth_girls'
       else 'youth_boys' end                            as after_this_runs,
  (select count(*) from fixtures f where f.competition_id = c.competition_id)
                                                        as fixtures
from competitions c
where c.division = 'youth'
order by c.season nulls last, c.name;

-- ── Competitions ────────────────────────────────────────────
update competitions
set    division = case when name ilike '%girls%' then 'youth_girls'
                       else 'youth_boys' end
where  division = 'youth';

-- ── Teams ───────────────────────────────────────────────────
-- The constraint has to widen before anything can be written into it.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'teams_division_check') then
    alter table teams drop constraint teams_division_check;
  end if;

  alter table teams add constraint teams_division_check
    check (division in ('men', 'women', 'youth', 'youth_boys', 'youth_girls'));
end $$;

-- 'youth' is left allowed above on purpose: a team row nobody has classified
-- yet should not stop the club being saved. The code reads a bare 'youth' as
-- youth without a gender said, which counts towards a youth setup and not
-- towards a women's one — the cautious reading, and the one that cannot hand
-- out credit nobody earned.
update teams
set    division = 'youth_girls'
where  division = 'youth'
  and  name ilike '%girls%';

update teams
set    division = 'youth_boys'
where  division = 'youth'
  and  name not ilike '%girls%';

-- ── What is on record now ───────────────────────────────────
select division, count(*) as competitions
from competitions group by division order by division;

select division, count(*) as teams
from teams group by division order by division;
