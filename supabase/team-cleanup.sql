-- ============================================================
-- GRLF — Team classification + duplicate merge
--
-- 1. Add `team_type` to `teams` ('club' | 'national' | 'president_xv').
-- 2. Classify the 6 representative teams (3 national + 3 president XIII).
-- 3. Merge three duplicate team rows — the shorter names pre-date
--    "Accra" / "UG" / "Nungua" being tacked on:
--      Panthers   -> Accra Panthers
--      Titans     -> UG Titans
--      Tigers     -> Nungua Tigers
--
--    Players, player_history, fixtures (home+away) and match_events
--    are all re-pointed to the canonical team before the old team
--    row is deleted. FKs stay intact throughout.
--
-- Idempotent: safe to re-run. The DO block short-circuits if the
-- old team is already gone.
-- ============================================================

-- 1) team_type column -----------------------------------------

alter table teams
  add column if not exists team_type text not null default 'club';

-- Enforce valid values (drop-and-recreate so re-runs don't fail).
alter table teams drop constraint if exists teams_team_type_check;
alter table teams
  add constraint teams_team_type_check
  check (team_type in ('club', 'national', 'president_xv'));

-- 2) classify representative teams ----------------------------

update teams set team_type = 'national'
 where name in (
   'National Youth Team',
   'Men National Team',
   'Women National Team'
 );

update teams set team_type = 'president_xv'
 where name in (
   'Women President XIII',
   'Youth President XIII',
   'Men President XIII'
 );

-- Everything else stays 'club' (default).

-- 3) merge duplicates -----------------------------------------

do $$
declare
  -- short-name -> canonical-name pairs
  pairs text[][] := array[
    array['Panthers',  'Accra Panthers'],
    array['Titans',    'UG Titans'],
    array['Tigers',    'Nungua Tigers']
  ];
  pair text[];
  v_old uuid;
  v_new uuid;
  n_players int;
  n_history int;
  n_home int;
  n_away int;
  n_events int;
begin
  foreach pair slice 1 in array pairs loop
    select team_id into v_old from teams where name = pair[1];
    select team_id into v_new from teams where name = pair[2];

    if v_old is null then
      raise notice 'Skip: "%" already merged or never existed.', pair[1];
      continue;
    end if;
    if v_new is null then
      raise notice 'Skip: canonical "%" not found; cannot merge "%".', pair[2], pair[1];
      continue;
    end if;

    update players        set team_id = v_new where team_id = v_old;
    get diagnostics n_players = row_count;

    update player_history set team_id = v_new where team_id = v_old;
    get diagnostics n_history = row_count;

    update fixtures set home_team_id = v_new where home_team_id = v_old;
    get diagnostics n_home = row_count;

    update fixtures set away_team_id = v_new where away_team_id = v_old;
    get diagnostics n_away = row_count;

    update match_events   set team_id = v_new where team_id = v_old;
    get diagnostics n_events = row_count;

    -- Copy home_venue_id forward if the canonical has none.
    update teams
       set home_venue_id = coalesce(
         home_venue_id,
         (select home_venue_id from teams where team_id = v_old)
       )
     where team_id = v_new;

    delete from teams where team_id = v_old;

    raise notice
      'Merged "%": players=%, history=%, home_fix=%, away_fix=%, events=%',
      pair[1], n_players, n_history, n_home, n_away, n_events;
  end loop;
end$$;
