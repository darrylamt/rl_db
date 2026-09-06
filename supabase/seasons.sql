-- ============================================================
-- When a season runs, said rather than guessed.
--
-- The budget system had no idea what a season was. It took the calendar year
-- and called that the season, which meant the year rolled over on 1 January
-- while the rugby had finished in October — clubs spent one season's money
-- for two months after it ended, and the next season's budget could not be
-- granted until New Year even if a window opened in November.
--
-- The obvious fix was to read the dates off the competitions. It is the
-- wrong fix. A season holds several tournaments — 13s, 9s, eRugby, the
-- President's Cup — that start and finish at different times, so there is no
-- single end date to read. Worse, a boundary derived that way moves on its
-- own: enter a competition in August and the season retrospectively ends
-- later than it did yesterday. A date everything else depends on cannot be a
-- side effect of entering a fixture.
--
-- So the federation states it. One row per season, with the dates on it.
--
-- WHAT USES THIS
--   Budgets. The season a grant belongs to, whether that season has finished,
--   and therefore whether the next season's budget is due. Nothing is
--   automatic even so — the federation still presses the button; this only
--   decides which season it is pressing it for, and when it may.
--
-- IF THIS TABLE IS EMPTY OR MISSING
--   Everything falls back to the calendar year, exactly as it behaved
--   before. A migration that has not been run should not stop clubs trading.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists seasons (
  season     text primary key,
  starts_on  date not null,
  ends_on    date not null,
  -- Said to the federation on the finance page, so an unusual season can
  -- explain itself a year later.
  note       text,
  created_at timestamptz not null default now(),

  constraint a_season_ends_after_it_starts check (ends_on >= starts_on)
);

comment on table seasons is
  'When each season runs. Stated by the federation, never derived from fixtures.';

-- ── A starting point from what is already on record ─────────
-- A first draft for the federation to correct, not an authority — which is
-- the whole point of the table. Existing rows are left alone.
--
-- Drawn from competition dates and fixture dates together, taking the widest
-- span in each season. Neither source is sufficient alone: only a handful of
-- competitions carry both dates, and the ones that do can be narrower than
-- the rugby actually played under them. Using fixtures for a one-off draft
-- somebody then edits is a different thing from deriving the boundary from
-- them every time it is read, which is what this table exists to stop.
insert into seasons (season, starts_on, ends_on, note)
select
  d.season,
  min(d.from_date),
  max(d.to_date),
  'Seeded from the records to date. Check these dates and correct them.'
from (
  select c.season, c.start_date as from_date, c.end_date as to_date
  from competitions c
  where c.season is not null
    and c.start_date is not null
    and c.end_date is not null

  union all

  select c.season, f.scheduled_date, f.scheduled_date
  from fixtures f
  join competitions c on c.competition_id = f.competition_id
  where c.season is not null
    and f.scheduled_date is not null
) d
group by d.season
on conflict (season) do nothing;

-- ── What is on record ───────────────────────────────────────
select
  s.season,
  s.starts_on,
  s.ends_on,
  (current_date between s.starts_on and s.ends_on) as is_running_today,
  (current_date > s.ends_on)                       as has_finished
from seasons s
order by s.season desc;
