-- ============================================================
-- Put every player at a club under contract to 30 November 2026.
--
-- ONE THING TO KNOW FIRST
--
-- The rule is that a contract runs at least six months. Today is well past
-- the end of May, so a contract starting today and ending on 30 November
-- would be about three months and the database would refuse it — correctly.
--
-- These are not new agreements. They are the season everybody has already
-- been playing, written down. So they start on 1 January 2026, which is
-- where that season began, and run eleven months to 30 November. That is
-- inside the rule and it is also the truth: these players have been at these
-- clubs all year.
--
-- Only players currently at a club are covered. A free agent has nobody to
-- have a contract with.
--
-- Nobody is given a second contract: a player who already has one live is
-- skipped, so this can be run again safely.
--
-- Run AFTER contracts_and_players.sql, and after retire_four_clubs.sql if
-- that is being run at all — a released player should not be handed a
-- contract with the club they just left.
-- ============================================================

-- ── What is about to be written ─────────────────────────────
select
  t.name as club,
  count(*) as contracts_to_create
from players p
join teams t on t.team_id = p.team_id
where p.playing_status = 'active'
  and not exists (
    select 1 from contracts c
    where c.player_id = p.player_id and c.status in ('offered', 'accepted')
  )
group by t.name
order by t.name;

-- ── Write them ──────────────────────────────────────────────
-- Recorded as accepted rather than offered. These describe what has already
-- been happening; asking 187 players to accept a season they have played
-- would be theatre, and would leave every squad looking unsigned until they
-- got round to it.
insert into contracts (player_id, team_id, starts_on, ends_on, status, terms, answered_at)
select
  p.player_id,
  p.team_id,
  date '2026-01-01',
  date '2026-11-30',
  'accepted',
  'Existing 2026 season agreement, recorded when contracts were introduced.',
  now()
from players p
where p.team_id is not null
  and p.playing_status = 'active'
  and not exists (
    select 1 from contracts c
    where c.player_id = p.player_id and c.status in ('offered', 'accepted')
  );

-- ── Where things stand ──────────────────────────────────────
select
  count(*)                                                as contracts,
  count(*) filter (where status = 'accepted')             as live,
  min(ends_on)                                            as earliest_end,
  max(ends_on)                                            as latest_end,
  count(*) filter (where ends_on <= (current_date + interval '1 month')::date
                     and status = 'accepted')             as expiring_within_a_month
from contracts;
