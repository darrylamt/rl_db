-- ============================================================
-- At most 30 players per grade per club.
--
-- A club fields men, women, youth boys and youth girls from one team row,
-- and each of those squads is capped at 30. Inactive players do not count:
-- the cap is on who a club can call on, not on everybody who ever played.
--
-- Checked by the database rather than one form, because players reach a club
-- in several ways (the club adds them, the federation adds them, bulk import,
-- an approved transfer or loan, a status or grade change) and every one of
-- them must hit the same limit. Clubs already over it keep who they have;
-- they simply cannot add more until they are back under.
--
-- National and President's sides are not clubs and are not capped.
-- Safe to re-run.
-- ============================================================

create or replace function player_grade(category text, gender text)
returns text language sql immutable as $$
  select case
    when lower(replace(coalesce(category, ''), ' ', '_')) in ('senior_men', 'men', 'male') then 'senior_men'
    when lower(replace(coalesce(category, ''), ' ', '_')) in ('senior_women', 'women', 'female') then 'senior_women'
    when lower(replace(coalesce(category, ''), ' ', '_')) in ('youth_boys', 'youth_girls') then lower(replace(category, ' ', '_'))
    when lower(replace(coalesce(category, ''), ' ', '_')) = 'youth' and lower(coalesce(gender, '')) like 'f%' then 'youth_girls'
    when lower(replace(coalesce(category, ''), ' ', '_')) = 'youth' and lower(coalesce(gender, '')) like 'm%' then 'youth_boys'
    else null
  end
$$;

create or replace function enforce_squad_grade_cap()
returns trigger language plpgsql as $$
declare
  cap constant int := 30;
  g text := player_grade(new.category, new.gender);
  club record;
  taken int;
begin
  if new.team_id is null or g is null or coalesce(new.playing_status, '') = 'inactive' then
    return new;
  end if;

  -- Already counted here before this change: nothing new is being added.
  if tg_op = 'UPDATE'
     and old.team_id is not distinct from new.team_id
     and player_grade(old.category, old.gender) is not distinct from g
     and coalesce(old.playing_status, '') <> 'inactive' then
    return new;
  end if;

  select name, team_type into club from teams where team_id = new.team_id;
  if club.team_type is distinct from 'club' then
    return new;
  end if;

  select count(*) into taken
  from players
  where team_id = new.team_id
    and player_id <> new.player_id
    and coalesce(playing_status, '') <> 'inactive'
    and player_grade(category, gender) = g;

  if taken >= cap then
    raise exception '% already has % % players. The limit is % per grade — make one inactive or move them on first.',
      club.name, taken,
      case g when 'senior_men' then 'men''s' when 'senior_women' then 'women''s'
             when 'youth_boys' then 'youth boys''' else 'youth girls''' end,
      cap
      using errcode = 'check_violation';
  end if;
  return new;
end
$$;

drop trigger if exists squad_grade_cap on players;
create trigger squad_grade_cap
  before insert or update of team_id, category, gender, playing_status on players
  for each row execute function enforce_squad_grade_cap();
