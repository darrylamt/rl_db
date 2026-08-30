-- ============================================================
-- A match clock, and walkovers.
--
-- A fixture is scheduled for 12:00 and kicks off at 12:05. The clock has to
-- start when the match does, not when the fixture said it would, so kickoff
-- is recorded as the moment the recorder presses start.
--
-- The clock is kept as timestamps rather than as a running minute pushed up
-- from the recorder's phone. A minute in a column is only correct until the
-- signal drops; timestamps stay correct through a lost connection, a closed
-- browser, and a spectator opening the page an hour in. Every viewer works
-- out the same minute from the same three facts.
--
-- Half time is a pause with a name. The clock carries straight on into the
-- second half, so the match reads 0 to 80 continuously.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

alter table fixtures
  add column if not exists kickoff_at        timestamptz,
  add column if not exists clock_state       text not null default 'not_started',
  add column if not exists paused_at         timestamptz,
  -- Every second the clock has been stopped, so elapsed match time is
  -- (now - kickoff_at - stoppage_seconds).
  add column if not exists stoppage_seconds  integer not null default 0,
  -- The side that did not turn up. Null for a match that was played.
  add column if not exists forfeited_by_team_id uuid references teams(team_id);

alter table fixtures drop constraint if exists fixtures_clock_state_check;
alter table fixtures
  add constraint fixtures_clock_state_check
  check (clock_state in ('not_started', 'running', 'paused', 'half_time', 'finished'));

comment on column fixtures.kickoff_at is
  'When the match actually started — minute zero. Not the scheduled time.';
comment on column fixtures.stoppage_seconds is
  'Accumulated seconds the clock has been stopped, half time included.';
comment on column fixtures.forfeited_by_team_id is
  'The team that did not turn up. The other side is awarded the match.';

-- ── The live page has to hear about clock changes ───────────
-- fixtures may already be published; adding it twice is an error, so only
-- add it when it is missing.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'fixtures'
  ) then
    alter publication supabase_realtime add table fixtures;
  end if;
end $$;

-- ── What the clock looks like now ───────────────────────────
select f.fixture_id, f.scheduled_date, f.clock_state, f.kickoff_at, f.stoppage_seconds
from fixtures f
where f.clock_state <> 'not_started'
order by f.scheduled_date desc
limit 20;
