-- ----------------------------------------------------------------------
-- A player has one main position, and may cover others.
--
-- players.position stays exactly what it was: the main, dominant position.
-- Everything weighted by role reads that one column and keeps working —
-- a prop is judged on different things from a winger, and that judgement
-- needs a single answer, not a list.
--
-- The others are squad depth: who can cover hooker if the hooker is hurt.
-- They are deliberately NOT used for rating.
-- ----------------------------------------------------------------------

alter table players
  add column if not exists secondary_positions text[] not null default '{}';

-- The same closed list the app offers, enforced here so a stray value cannot
-- arrive by any other route. ("Half Back" already sits in match_lineups from
-- before there was a list; this stops that happening again.)
alter table players
  drop constraint if exists players_secondary_positions_known;

alter table players
  add constraint players_secondary_positions_known check (
    secondary_positions <@ array[
      'Fullback','Wing','Centre','Stand-off','Scrum-half',
      'Prop','Hooker','Second-row','Loose forward','Utility'
    ]::text[]
  );

-- A secondary position that repeats the main one says nothing, and would make
-- "who can cover prop" double-count the props.
alter table players
  drop constraint if exists players_secondary_excludes_main;

alter table players
  add constraint players_secondary_excludes_main check (
    position is null or not (secondary_positions @> array[position])
  );

-- "Who can cover hooker" is a containment search, which needs GIN to not be a
-- full scan of every player at every club.
create index if not exists players_secondary_positions_idx
  on players using gin (secondary_positions);

comment on column players.secondary_positions is
  'Other positions this player can cover. The main one lives in players.position and is what any role-weighted rating uses.';
