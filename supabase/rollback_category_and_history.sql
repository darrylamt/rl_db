-- ============================================================
-- ROLLBACK: reverses migration_category_and_history.sql
-- Run in Supabase SQL editor.
-- ============================================================

-- Remove imported historical fixtures & results
-- (only removes ones added by the migration — matched by competition name pattern)
do $$
declare
  comp_ids uuid[];
begin
  select array_agg(competition_id) into comp_ids
  from competitions
  where name in (
    '2019 Ghana Rugby League Championship',
    '2021 Ghana Rugby League Championship',
    '2022 RLFG 13s Championship',
    '2024 Ghana Rugby League Championship (Men 13s)',
    '2024 Ghana Rugby League Championship (Youth 13s)',
    '2024 Ghana Rugby League Championship (Men 9s)',
    '2024 Ghana Rugby League Championship (Women 9s)',
    '2025 Ghana Rugby League Championship'
  );

  if comp_ids is not null then
    -- delete match_events for those fixtures
    delete from match_events where fixture_id in (
      select fixture_id from fixtures where competition_id = any(comp_ids)
    );
    -- delete lineups
    delete from match_lineups where fixture_id in (
      select fixture_id from fixtures where competition_id = any(comp_ids)
    );
    -- delete match results
    delete from match_results where fixture_id in (
      select fixture_id from fixtures where competition_id = any(comp_ids)
    );
    -- delete fixtures
    delete from fixtures where competition_id = any(comp_ids);
    -- delete competitions
    delete from competitions where competition_id = any(comp_ids);
  end if;
end$$;

-- Remove women & youth players added by the migration (inactive, with category)
delete from players
where playing_status = 'inactive'
  and category in ('senior_women', 'youth')
  and created_at > now() - interval '7 days'; -- safety: only recent inserts

-- Remove historical teams added by the migration
do $$
declare t uuid;
begin
  for t in
    select team_id from teams
    where name in ('Pirates','African Warriors','Accra Majestics','Accra Bears','Firm Foundation')
      and not exists (select 1 from fixtures f where f.home_team_id = teams.team_id or f.away_team_id = teams.team_id)
  loop
    delete from teams where team_id = t;
  end loop;
end$$;

-- Drop division column from competitions
alter table competitions drop column if exists division;

-- Drop category column from players
alter table players drop column if exists category;

-- Revert standings view (no division column)
drop view if exists standings;
create view standings as
select
  t.team_id, t.name as team_name, t.logo_url,
  c.competition_id, c.name as competition_name, c.season,
  count(r.result_id) as played,
  count(case when (f.home_team_id=t.team_id and r.home_score>r.away_score)
               or (f.away_team_id=t.team_id and r.away_score>r.home_score) then 1 end) as won,
  count(case when (f.home_team_id=t.team_id and r.home_score<r.away_score)
               or (f.away_team_id=t.team_id and r.away_score<r.home_score) then 1 end) as lost,
  count(case when r.home_score=r.away_score then 1 end) as drawn,
  sum(case when f.home_team_id=t.team_id then r.home_score else r.away_score end) as points_for,
  sum(case when f.home_team_id=t.team_id then r.away_score else r.home_score end) as points_against,
  (count(case when (f.home_team_id=t.team_id and r.home_score>r.away_score)
                or (f.away_team_id=t.team_id and r.away_score>r.home_score) then 1 end)*2)
  + count(case when r.home_score=r.away_score then 1 end) as league_points
from teams t
join fixtures f on f.home_team_id=t.team_id or f.away_team_id=t.team_id
join competitions c on c.competition_id=f.competition_id
join match_results r on r.fixture_id=f.fixture_id
where f.status='completed'
group by t.team_id,t.name,t.logo_url,c.competition_id,c.name,c.season
order by league_points desc, points_for desc;

-- Revert public_players view (no category column)
drop view if exists public_players;
create view public_players as
select
  player_id, team_id, first_name, last_name, date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer end as age,
  height_cm, weight_kg, nationality, jersey_number, position,
  is_captain, playing_status, gender, photo_url, created_at
from players;

-- Drop the helper function if it wasn't cleaned up
drop function if exists _rlfg_ins_fixture(uuid,uuid,uuid,date,uuid,int,int);
