-- ============================================================
-- RLFG Migration: player category + historical data import
-- Safe to re-run (idempotent). Run in Supabase SQL editor.
-- ============================================================

-- ── 1. ADD category COLUMN TO PLAYERS ─────────────────────
alter table players add column if not exists category text default 'senior_men';
update players set category = 'senior_men' where category is null;

-- ── 2. ADD division COLUMN TO COMPETITIONS ─────────────────
-- Values: 'men', 'women', 'youth'
alter table competitions add column if not exists division text default 'men';

-- ── 3. ENSURE CORE VENUES EXIST ────────────────────────────
do $$
begin
  if not exists (select 1 from venues where name ilike '%legon rugby%') then
    insert into venues(name,city,region) values('Legon Rugby Field','Accra','Greater Accra');
  end if;
  if not exists (select 1 from venues where name ilike '%ajax%') then
    insert into venues(name,city,region) values('Ajax Park','Accra','Greater Accra');
  end if;
  if not exists (select 1 from venues where name ilike '%wembley%' or name ilike '%ug rugby%') then
    insert into venues(name,city,region) values('UG Rugby League Stadium','Accra','Greater Accra');
  end if;
end$$;

-- ── 4. ENSURE HISTORICAL TEAMS EXIST ───────────────────────
do $$
declare
  teams_needed text[][] := array[
    array['Accra Panthers','panther'],
    array['Bulls','bulls'],
    array['Skolars','skolar'],
    array['Nungua Tigers','tiger'],
    array['Pirates','pirate'],
    array['African Warriors','warrior'],
    array['Accra Majestics','majestic'],
    array['Accra Bears','bear'],
    array['UG Titans','titan'],
    array['Firm Foundation','firm foundation']
  ];
  t text[];
  v uuid;
begin
  foreach t slice 1 in array teams_needed loop
    select team_id into v from teams where name ilike ('%'||t[2]||'%') limit 1;
    if v is null then
      insert into teams(name,team_type) values(t[1],'club');
    end if;
  end loop;
end$$;

-- ── 5. ENSURE COMPETITIONS EXIST ───────────────────────────
do $$
declare
  comps text[][] := array[
    array['2019 Ghana Rugby League Championship','2019','league','men'],
    array['2021 Ghana Rugby League Championship','2021','league','men'],
    array['2022 RLFG 13s Championship','2022','league','men'],
    array['2024 Ghana Rugby League Championship (Men 13s)','2024','league','men'],
    array['2024 Ghana Rugby League Championship (Youth 13s)','2024','league','youth'],
    array['2024 Ghana Rugby League Championship (Men 9s)','2024','league','men'],
    array['2024 Ghana Rugby League Championship (Women 9s)','2024','league','women'],
    array['2025 Ghana Rugby League Championship','2025','league','men']
  ];
  c text[];
  v uuid;
begin
  foreach c slice 1 in array comps loop
    select competition_id into v from competitions where name=c[1] and season=c[2] limit 1;
    if v is null then
      insert into competitions(name,season,type,division,status)
      values(c[1],c[2],c[3],c[4],'completed');
    else
      update competitions set division=c[4] where competition_id=v and (division is null or division='men');
    end if;
  end loop;
end$$;

-- ── 6. HELPER FUNCTION for inserting fixtures ───────────────
-- Must be created outside DO block.
create or replace function _rlfg_ins_fixture(
  p_comp     uuid,
  p_home     uuid,
  p_away     uuid,
  p_date     date,
  p_venue    uuid,
  p_home_sc  int,
  p_away_sc  int
) returns void language plpgsql as $$
declare
  fid uuid;
begin
  if p_comp is null or p_home is null or p_away is null then return; end if;
  select fixture_id into fid
  from fixtures
  where competition_id=p_comp
    and home_team_id=p_home
    and away_team_id=p_away
    and scheduled_date=p_date
  limit 1;

  if fid is null then
    insert into fixtures(competition_id,home_team_id,away_team_id,scheduled_date,venue_id,status)
    values(p_comp,p_home,p_away,p_date,p_venue,'completed')
    returning fixture_id into fid;
  else
    update fixtures set status='completed' where fixture_id=fid;
  end if;

  insert into match_results(fixture_id,home_score,away_score)
  values(fid,p_home_sc,p_away_sc)
  on conflict (fixture_id) do update
    set home_score=excluded.home_score, away_score=excluded.away_score;
end;
$$;

-- ── 7. IMPORT HISTORICAL FIXTURES & RESULTS ────────────────
do $$
declare
  c_2019  uuid; c_2021  uuid; c_2022  uuid;
  c_2024m uuid; c_2024y uuid; c_2024n uuid; c_2024w uuid;
  t_bulls uuid; t_panth uuid; t_skol  uuid;
  t_tiger uuid; t_pirate uuid; t_warr uuid;
  t_maj   uuid; t_titan  uuid;
  v_legon uuid; v_ajax  uuid; v_wembley uuid;
begin
  select competition_id into c_2019  from competitions where season='2019' and division='men' limit 1;
  select competition_id into c_2021  from competitions where season='2021' and division='men' limit 1;
  select competition_id into c_2022  from competitions where season='2022' and division='men' limit 1;
  select competition_id into c_2024m from competitions where name like '%Men 13s%' limit 1;
  select competition_id into c_2024y from competitions where name like '%Youth 13s%' limit 1;
  select competition_id into c_2024n from competitions where name like '%Men 9s%' limit 1;
  select competition_id into c_2024w from competitions where name like '%Women 9s%' limit 1;

  select team_id into t_bulls  from teams where name ilike 'bulls'            limit 1;
  select team_id into t_panth  from teams where name ilike '%panther%'        limit 1;
  select team_id into t_skol   from teams where name ilike '%skolar%'         limit 1;
  select team_id into t_tiger  from teams where name ilike '%tiger%'          limit 1;
  select team_id into t_pirate from teams where name ilike '%pirate%'         limit 1;
  select team_id into t_warr   from teams where name ilike '%warrior%'        limit 1;
  select team_id into t_maj    from teams where name ilike '%majestic%'       limit 1;
  select team_id into t_titan  from teams where name ilike '%titan%'          limit 1;

  select venue_id into v_legon   from venues where name ilike '%legon rugby%' limit 1;
  select venue_id into v_ajax    from venues where name ilike '%ajax%'        limit 1;
  select venue_id into v_wembley from venues where name ilike '%wembley%' or name ilike '%ug rugby%' limit 1;

  -- 2019
  perform _rlfg_ins_fixture(c_2019,t_bulls, t_skol,  '2019-05-05',v_legon,38,18);
  perform _rlfg_ins_fixture(c_2019,t_pirate,t_panth, '2019-05-05',v_legon,22,34);
  perform _rlfg_ins_fixture(c_2019,t_bulls, t_pirate,'2019-06-02',v_legon,36,18);
  perform _rlfg_ins_fixture(c_2019,t_panth, t_skol,  '2019-06-02',v_legon,18,38);
  perform _rlfg_ins_fixture(c_2019,t_skol,  t_pirate,'2019-06-09',v_legon,24,16);
  perform _rlfg_ins_fixture(c_2019,t_panth, t_bulls, '2019-06-09',v_legon,16,40);
  perform _rlfg_ins_fixture(c_2019,t_skol,  t_pirate,'2019-06-23',v_legon,30, 0);
  perform _rlfg_ins_fixture(c_2019,t_bulls, t_panth, '2019-06-23',v_legon,30, 0);
  perform _rlfg_ins_fixture(c_2019,t_panth, t_skol,  '2019-06-30',v_legon,12,22);
  perform _rlfg_ins_fixture(c_2019,t_bulls, t_pirate,'2019-06-30',v_legon,34,10);
  perform _rlfg_ins_fixture(c_2019,t_panth, t_pirate,'2019-07-07',v_legon,20, 6);
  perform _rlfg_ins_fixture(c_2019,t_skol,  t_bulls, '2019-07-07',v_legon,30,40);

  -- 2021
  perform _rlfg_ins_fixture(c_2021,t_panth, t_skol,  '2021-05-23',v_legon,16, 6);
  perform _rlfg_ins_fixture(c_2021,t_skol,  t_tiger, '2021-05-30',v_legon,26, 0);
  perform _rlfg_ins_fixture(c_2021,t_bulls, t_tiger, '2021-05-30',v_legon, 8, 6);
  perform _rlfg_ins_fixture(c_2021,t_bulls, t_panth, '2021-06-20',v_legon,10, 6);
  perform _rlfg_ins_fixture(c_2021,t_panth, t_skol,  '2021-06-27',v_legon, 0,14);
  perform _rlfg_ins_fixture(c_2021,t_tiger, t_bulls, '2021-06-27',v_legon, 0, 8);
  perform _rlfg_ins_fixture(c_2021,t_bulls, t_skol,  '2021-06-06',v_legon,20,18);
  perform _rlfg_ins_fixture(c_2021,t_panth, t_tiger, '2021-06-06',v_legon,12, 0);
  perform _rlfg_ins_fixture(c_2021,t_panth, t_tiger, '2021-07-04',v_legon,22, 6);
  perform _rlfg_ins_fixture(c_2021,t_bulls, t_skol,  '2021-07-04',v_legon, 8,14);

  -- 2022
  perform _rlfg_ins_fixture(c_2022,t_tiger, t_pirate,'2022-05-01',v_ajax, 20, 0);
  perform _rlfg_ins_fixture(c_2022,t_warr,  t_bulls, '2022-05-01',v_ajax,  0,66);
  perform _rlfg_ins_fixture(c_2022,t_panth, t_skol,  '2022-05-01',v_ajax, 16,35);
  perform _rlfg_ins_fixture(c_2022,t_bulls, t_tiger, '2022-05-08',v_ajax, 24,14);
  perform _rlfg_ins_fixture(c_2022,t_tiger, t_warr,  '2022-05-06',v_ajax, 28, 6);
  perform _rlfg_ins_fixture(c_2022,t_warr,  t_maj,   '2022-05-15',v_ajax,  0,16);
  perform _rlfg_ins_fixture(c_2022,t_panth, t_warr,  '2022-05-22',v_ajax, 48, 0);
  perform _rlfg_ins_fixture(c_2022,t_pirate,t_skol,  '2022-05-22',v_ajax,  5,24);
  perform _rlfg_ins_fixture(c_2022,t_bulls, t_skol,  '2022-05-29',v_ajax, 10,10);
  perform _rlfg_ins_fixture(c_2022,t_maj,   t_panth, '2022-08-05',v_ajax, 14,10);
  perform _rlfg_ins_fixture(c_2022,t_bulls, t_tiger, '2022-08-05',v_ajax, 24,14);
  perform _rlfg_ins_fixture(c_2022,t_warr,  t_skol,  '2022-08-05',v_ajax,  0,20);
  perform _rlfg_ins_fixture(c_2022,t_pirate,t_maj,   '2022-09-01',v_ajax, 10,30);
  perform _rlfg_ins_fixture(c_2022,t_tiger, t_skol,  '2022-10-01',v_ajax,  0,38);
  perform _rlfg_ins_fixture(c_2022,t_pirate,t_panth, '2022-10-15',v_ajax,  8,32);
  perform _rlfg_ins_fixture(c_2022,t_bulls, t_maj,   '2022-12-06',v_ajax, 34,12);

  -- 2024 Men 13s
  perform _rlfg_ins_fixture(c_2024m,t_bulls, t_tiger,'2024-01-28',v_ajax,14, 4);
  perform _rlfg_ins_fixture(c_2024m,t_maj,   t_panth,'2024-01-28',v_ajax, 0,16);
  perform _rlfg_ins_fixture(c_2024m,t_warr,  t_tiger,'2024-02-04',v_ajax,30, 0);
  perform _rlfg_ins_fixture(c_2024m,t_maj,   t_skol, '2024-02-04',v_ajax, 4,32);
  perform _rlfg_ins_fixture(c_2024m,t_bulls, t_panth,'2024-02-04',v_ajax,18,16);
  perform _rlfg_ins_fixture(c_2024m,t_bulls, t_skol, '2024-02-11',v_ajax,12, 6);
  perform _rlfg_ins_fixture(c_2024m,t_tiger, t_panth,'2024-02-11',v_ajax, 0,20);
  perform _rlfg_ins_fixture(c_2024m,t_warr,  t_maj,  '2024-02-11',v_ajax, 0,22);
  perform _rlfg_ins_fixture(c_2024m,t_maj,   t_tiger,'2024-02-18',v_ajax,16, 8);
  perform _rlfg_ins_fixture(c_2024m,t_skol,  t_panth,'2024-02-18',v_ajax,26, 4);
  perform _rlfg_ins_fixture(c_2024m,t_bulls, t_warr, '2024-02-18',v_ajax,26, 4);
  perform _rlfg_ins_fixture(c_2024m,t_maj,   t_bulls,'2024-03-03',v_ajax, 8,26);
  perform _rlfg_ins_fixture(c_2024m,t_panth, t_warr, '2024-03-03',v_ajax,10, 8);
  perform _rlfg_ins_fixture(c_2024m,t_skol,  t_tiger,'2024-03-03',v_ajax,40, 6);
  perform _rlfg_ins_fixture(c_2024m,t_warr,  t_skol, '2024-04-14',v_ajax, 0, 8);
  perform _rlfg_ins_fixture(c_2024m,t_warr,  t_skol, '2024-04-21',v_ajax, 6, 8);
  perform _rlfg_ins_fixture(c_2024m,t_panth, t_maj,  '2024-04-21',v_ajax,14,14);
  perform _rlfg_ins_fixture(c_2024m,t_tiger, t_bulls,'2024-04-21',v_ajax, 0,22);

  -- 2024 Youth 13s
  perform _rlfg_ins_fixture(c_2024y,t_warr,  t_panth,'2024-03-10',v_ajax, 4, 8);
  perform _rlfg_ins_fixture(c_2024y,t_panth, t_tiger,'2024-03-17',v_ajax,18, 4);
  perform _rlfg_ins_fixture(c_2024y,t_warr,  t_tiger,'2024-03-24',v_ajax,40, 4);
  perform _rlfg_ins_fixture(c_2024y,t_panth, t_warr, '2024-04-07',v_ajax, 0,22);
  perform _rlfg_ins_fixture(c_2024y,t_warr,  t_skol, '2024-04-14',v_ajax,12, 0);
  perform _rlfg_ins_fixture(c_2024y,t_panth, t_tiger,'2024-04-14',v_ajax,14,16);
  perform _rlfg_ins_fixture(c_2024y,t_tiger, t_skol, '2024-04-21',v_ajax, 0, 4);
  perform _rlfg_ins_fixture(c_2024y,t_skol,  t_warr, '2024-04-28',v_ajax, 0, 6);
  perform _rlfg_ins_fixture(c_2024y,t_tiger, t_warr, '2024-05-05',v_ajax,12,26);
  perform _rlfg_ins_fixture(c_2024y,t_panth, t_skol, '2024-05-19',v_ajax, 4, 4);
  perform _rlfg_ins_fixture(c_2024y,t_skol,  t_panth,'2024-05-26',v_wembley,0,16);
  perform _rlfg_ins_fixture(c_2024y,t_skol,  t_tiger,'2024-07-21',v_wembley,10,0);

  -- 2024 Men 9s
  perform _rlfg_ins_fixture(c_2024n,t_bulls, t_titan,'2024-10-06',v_wembley,29, 0);
  perform _rlfg_ins_fixture(c_2024n,t_skol,  t_panth,'2024-10-06',v_wembley,22, 4);
  perform _rlfg_ins_fixture(c_2024n,t_tiger, t_maj,  '2024-10-06',v_wembley,12, 0);
  perform _rlfg_ins_fixture(c_2024n,t_titan, t_skol, '2024-10-06',v_wembley, 0,24);
  perform _rlfg_ins_fixture(c_2024n,t_maj,   t_panth,'2024-10-06',v_wembley, 0, 4);
  perform _rlfg_ins_fixture(c_2024n,t_tiger, t_bulls,'2024-10-06',v_wembley,27,12);
  perform _rlfg_ins_fixture(c_2024n,t_skol,  t_maj,  '2024-10-06',v_wembley,15, 0);
  perform _rlfg_ins_fixture(c_2024n,t_titan, t_tiger,'2024-10-06',v_wembley, 0,30);
  perform _rlfg_ins_fixture(c_2024n,t_panth, t_bulls,'2024-10-06',v_wembley, 4, 4);
  perform _rlfg_ins_fixture(c_2024n,t_tiger, t_skol, '2024-10-06',v_wembley, 0,13);
  perform _rlfg_ins_fixture(c_2024n,t_bulls, t_maj,  '2024-10-06',v_wembley,20, 4);
  perform _rlfg_ins_fixture(c_2024n,t_titan, t_panth,'2024-10-13',v_wembley, 0,30);
  perform _rlfg_ins_fixture(c_2024n,t_tiger, t_panth,'2024-10-13',v_wembley,14, 0);
  perform _rlfg_ins_fixture(c_2024n,t_maj,   t_titan,'2024-10-13',v_wembley, 9, 4);
  perform _rlfg_ins_fixture(c_2024n,t_skol,  t_bulls,'2024-10-13',v_wembley,21,11);
  perform _rlfg_ins_fixture(c_2024n,t_titan, t_bulls,'2024-10-13',v_wembley, 0,30);
  perform _rlfg_ins_fixture(c_2024n,t_maj,   t_tiger,'2024-10-13',v_wembley, 4,22);

  -- 2024 Women 9s
  perform _rlfg_ins_fixture(c_2024w,t_panth, t_bulls,'2024-10-13',v_wembley,12, 4);
  perform _rlfg_ins_fixture(c_2024w,t_maj,   t_tiger,'2024-10-13',v_wembley, 0,16);

end$$;

-- Drop the helper (cleanup)
drop function if exists _rlfg_ins_fixture(uuid,uuid,uuid,date,uuid,int,int);

-- ── 8. WOMEN & YOUTH PLAYERS ───────────────────────────────
do $$
declare
  t_tiger uuid; t_bulls uuid; t_panth uuid; t_skol uuid;
begin
  select team_id into t_tiger from teams where name ilike '%tiger%' limit 1;
  select team_id into t_bulls from teams where name ilike 'bulls' limit 1;
  select team_id into t_panth from teams where name ilike '%panther%' limit 1;
  select team_id into t_skol  from teams where name ilike '%skolar%' limit 1;

  -- NUNGUA TIGERS SENIOR WOMEN
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_tiger,p.fn,p.ln,'inactive','female','senior_women'
  from (values
    ('Frances','Ashia'),('Rosemary','Sewornu'),('Angela','Adjuik'),
    ('Leticia','Zormelo'),('Ivy','Benyah'),('Estelle','Haizel')
  ) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_tiger and x.first_name=p.fn and x.last_name=p.ln);

  -- NUNGUA TIGERS YOUTH (male)
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_tiger,p.fn,p.ln,'inactive','male','youth'
  from (values
    ('Benjamin','Ntiamoah'),('Teddy','Agakah'),('Brian','Torgbor'),
    ('Ezekiel','Yankey'),('Leslie','McCarthy'),('Prince','Boateng'),
    ('Steven','Otoo'),('Godfred','Owusu'),('Enoch','Ayiduvor'),
    ('Richard','Owusu'),('Emmanuel','Afriyie'),('Maruf','Aminu')
  ) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_tiger and x.first_name=p.fn and x.last_name=p.ln);

  -- NUNGUA TIGERS YOUTH (female)
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_tiger,p.fn,p.ln,'inactive','female','youth'
  from (values ('Asupah','Charity'),('Aseye','Akuklu'),('Angela','Ayeduvor')) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_tiger and x.first_name=p.fn and x.last_name=p.ln);

  -- BULLS SENIOR WOMEN
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_bulls,p.fn,p.ln,'inactive','female','senior_women'
  from (values
    ('Naomi','Dugli'),('Grace','Arkoh'),('Millicent','Njomaba'),
    ('Fredrica','Alomatu'),('Jacqueline','Ansah')
  ) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_bulls and x.first_name=p.fn and x.last_name=p.ln);

  -- BULLS YOUTH (male)
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_bulls,p.fn,p.ln,'inactive','male','youth'
  from (values ('John','Gyan'),('Kevin','Boadu'),('Dennis','Allotey'),('Moses','Agyei')) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_bulls and x.first_name=p.fn and x.last_name=p.ln);

  -- BULLS YOUTH (female)
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_bulls,p.fn,p.ln,'inactive','female','youth'
  from (values ('Sonia','Nuoriyee')) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_bulls and x.first_name=p.fn and x.last_name=p.ln);

  -- ACCRA PANTHERS SENIOR WOMEN
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_panth,p.fn,p.ln,'inactive','female','senior_women'
  from (values
    ('Gloria','Ankrah'),('Etisam','Abubakar'),('Edna','Yebribe'),
    ('Fauziya','Nurudeen'),('Thelma','Simms-Golo'),('Falila','Abu'),
    ('Hilaria','Wuaku'),('Margaret','Tuffour'),('Adongo','Elizabeth'),
    ('Jennifer','Dzikunu'),('Adu','Aboagye'),('Davis','Effah Kaufmann'),
    ('Harriet','Adjetey'),('Evelyn','Noi')
  ) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_panth and x.first_name=p.fn and x.last_name=p.ln);

  -- GHANA SKOLARS SENIOR WOMEN
  insert into players(team_id,first_name,last_name,playing_status,gender,category)
  select t_skol,p.fn,p.ln,'inactive','female','senior_women'
  from (values
    ('Edinam','Yengbe'),('Nadia','Enyan'),('Shamsiya','Tahiru'),
    ('Joyce','Mamle'),('Melanie','Wright'),('Adiza','Bogobiri'),
    ('Monique','Ewomvor'),('Freda','Kumi'),('Audrey','Quaynor'),
    ('Jacqueline','Ayitey'),('Eunice','Awuni'),('Katumi','Ayuba')
  ) as p(fn,ln)
  where not exists (select 1 from players x where x.team_id=t_skol and x.first_name=p.fn and x.last_name=p.ln);

end$$;

-- ── 9. UPDATE standings view to include division ─────────────
drop view if exists standings;
create view standings as
select
  t.team_id, t.name as team_name, t.logo_url,
  c.competition_id, c.name as competition_name, c.season, c.division,
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
group by t.team_id,t.name,t.logo_url,c.competition_id,c.name,c.season,c.division
order by league_points desc, points_for desc;

-- ── 10. UPDATE public_players view ─────────────────────────
drop view if exists public_players;
create view public_players as
select
  player_id, team_id, first_name, last_name, date_of_birth,
  case when date_of_birth is null then null
       else extract(year from age(date_of_birth))::integer end as age,
  height_cm, weight_kg, nationality, jersey_number, position,
  is_captain, playing_status, gender, category, photo_url, created_at
from players;

-- ── Verify ──────────────────────────────────────────────────
select category, gender, count(*) from players group by category, gender order by category, gender;
select c.season, c.division, c.name, count(f.fixture_id) as fixtures
from competitions c
left join fixtures f on f.competition_id=c.competition_id
group by c.competition_id, c.season, c.division, c.name
order by c.season, c.division;
