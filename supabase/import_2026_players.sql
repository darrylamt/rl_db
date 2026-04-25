-- ============================================================
-- RLFG 2026 Player Registration Import
-- Run AFTER migrations.sql in the Supabase SQL editor.
-- Safe to re-run (inserts on conflict do nothing; registrations upsert).
-- ============================================================

-- Step 0: temp staging table for collected player IDs
create temp table if not exists _import_ids (
  player_id uuid,
  team_id   uuid
);
truncate _import_ids;

-- ── Step 1: Get / create teams ──────────────────────────────
do $$
declare
  v uuid;
  teams_needed text[][] := array[
    array['Accra Panthers', 'panther'],
    array['Bulls',          'bulls'],
    array['Dragons RL',     'dragon'],
    array['Nungua Tigers',  'tiger'],
    array['Skolars',        'skolar'],
    array['UG Titans',      'titan']
  ];
  t text[];
begin
  foreach t slice 1 in array teams_needed loop
    select team_id into v from teams where name ilike ('%' || t[2] || '%') limit 1;
    if v is null then
      insert into teams(name, team_type) values(t[1], 'club');
      raise notice 'Created team: %', t[1];
    else
      raise notice 'Found team %: %', t[1], v;
    end if;
  end loop;
end$$;

-- ── Step 2: Insert players + collect IDs ────────────────────

-- ACCRA PANTHERS
with team as (select team_id from teams where name ilike '%panther%' limit 1),
ins as (
  insert into players(team_id, first_name, last_name, date_of_birth, playing_status)
  select t.team_id, p.fn, p.ln, p.dob::date, 'inactive'
  from team t,
  (values
    ('Adam',        'Marsuu',             '1994-04-01'),
    ('Stanley',     'Dzagah',             '2000-06-16'),
    ('Abraham',     'Adjetey',            '2007-09-19'),
    ('Kofi',        'Adusei Abah',        '2008-10-17'),
    ('Norbert',     'Addoquaye Addo',     '2007-05-23'),
    ('Oumar',       'Niane',              '1999-11-07'),
    ('Emmanuel',    'Bonney',             '2005-11-11'),
    ('Adam',        'Ibrahim Adam',       '1996-11-24'),
    ('Agbemenu',    'Kodzo Tony',         '1997-03-24'),
    ('Kelvin',      'Kouffie',            '1999-06-30'),
    ('Emir',        'Julius Fiakpornu',   '1990-04-02'),
    ('Arimiyaw',    'Shariff',            '2002-01-06'),
    ('Akwei',       'Godfred Adotei',     '2005-10-20'),
    ('Bolfrey',     'William Abbam',      '2001-07-25'),
    ('Godwin',      'Asamoah',            '2001-12-05'),
    ('Islam',       'Issaka Abubakar',    '1995-10-10'),
    ('Osman',       'E. Abugre',          '2006-02-24'),
    ('Sheihu',      'Tijani',             '1999-07-16'),
    ('Amoako',      'Yeboah Maxwell',     '1995-07-10'),
    ('William',     'Asilevi',            '1999-06-12'),
    ('Jesus',       'Jerry Lartey',       '2011-12-25'),
    ('Darko',       'Felix Kweku',        '1988-11-08'),
    ('Abdul',       'Jalilu Yussif',      '1989-01-01')
  ) as p(fn, ln, dob)
  on conflict do nothing
  returning player_id, team_id
)
insert into _import_ids select player_id, team_id from ins;

-- Catch already-existing Panthers
insert into _import_ids(player_id, team_id)
select p.player_id, p.team_id
from players p
join teams t on t.team_id = p.team_id and t.name ilike '%panther%'
where (p.first_name, p.last_name) in (
  ('Adam','Marsuu'),('Stanley','Dzagah'),('Abraham','Adjetey'),
  ('Kofi','Adusei Abah'),('Norbert','Addoquaye Addo'),('Oumar','Niane'),
  ('Emmanuel','Bonney'),('Adam','Ibrahim Adam'),('Agbemenu','Kodzo Tony'),
  ('Kelvin','Kouffie'),('Emir','Julius Fiakpornu'),('Arimiyaw','Shariff'),
  ('Akwei','Godfred Adotei'),('Bolfrey','William Abbam'),('Godwin','Asamoah'),
  ('Islam','Issaka Abubakar'),('Osman','E. Abugre'),('Sheihu','Tijani'),
  ('Amoako','Yeboah Maxwell'),('William','Asilevi'),('Jesus','Jerry Lartey'),
  ('Darko','Felix Kweku'),('Abdul','Jalilu Yussif')
);

-- BULLS
with team as (select team_id from teams where name ilike 'bulls' limit 1),
ins as (
  insert into players(team_id, first_name, last_name, date_of_birth, playing_status)
  select t.team_id, p.fn, p.ln, p.dob::date, 'inactive'
  from team t,
  (values
    ('Bright',       'Bawah',             '2002-07-27'),
    ('Abdul-Mumuni', 'Iddi',              '1998-01-24'),
    ('Apalbilah',    'Joshua',            '1999-12-24'),
    ('Kelvin',       'Nkansah Annor',     '2005-08-30'),
    ('Richard',      'Browne Asare',      '2001-01-08'),
    ('Hakeem',       'Inusah Sugri',      '1998-05-15'),
    ('Kwasi',        'Akuamoah Boateng',  '1999-10-24'),
    ('Kwamena',      'Afful Cleland',     '1996-05-11'),
    ('Kevin',        'Boadu',             '2001-04-10'),
    ('Kwaku',        'Akoto Osei',        '1997-11-12'),
    ('Leslie',       'Boadu',             '2002-08-29'),
    ('Ephraim',      'Aniagyei',          '2001-05-03'),
    ('Etornam',      'B. Akrong',         '1994-05-20'),
    ('Wulff',        'Bevis Wilfred',     '2002-02-02'),
    ('Martin',       'Osei Buabeng',      '1998-05-16'),
    ('Ashford',      'Williams',          '1994-12-10'),
    ('Brian',        'Sackey',            '2000-05-07'),
    ('Kwabena',      'Kyei-Boafo',        '1999-01-12'),
    ('Nikoi',        'Reindorf Kotey',    '2001-08-11'),
    ('Christian',    'F.W.K Okpattah',   '1996-10-26'),
    ('Benjamin',     'Anane',             '1998-12-20'),
    ('Collins',      'Kweku Ofosu',       '1997-08-15'),
    ('Nigel',        'Sackey',            '1998-05-07'),
    ('Philip',       'Asomani',           '1990-06-24'),
    ('George',       'Tete Mensah',       '2000-05-03'),
    ('Wilkins',      'Nii Kpani Addy',   '2003-05-12'),
    ('Darryl',       'Amoatey',           '1999-09-01'),
    ('Emmanuel',     'Arku Boison',       '1999-12-21')
  ) as p(fn, ln, dob)
  on conflict do nothing
  returning player_id, team_id
)
insert into _import_ids select player_id, team_id from ins;

insert into _import_ids(player_id, team_id)
select p.player_id, p.team_id
from players p
join teams t on t.team_id = p.team_id and t.name ilike 'bulls'
where (p.first_name, p.last_name) in (
  ('Bright','Bawah'),('Abdul-Mumuni','Iddi'),('Apalbilah','Joshua'),
  ('Kelvin','Nkansah Annor'),('Richard','Browne Asare'),('Hakeem','Inusah Sugri'),
  ('Kwasi','Akuamoah Boateng'),('Kwamena','Afful Cleland'),('Kevin','Boadu'),
  ('Kwaku','Akoto Osei'),('Leslie','Boadu'),('Ephraim','Aniagyei'),
  ('Etornam','B. Akrong'),('Wulff','Bevis Wilfred'),('Martin','Osei Buabeng'),
  ('Ashford','Williams'),('Brian','Sackey'),('Kwabena','Kyei-Boafo'),
  ('Nikoi','Reindorf Kotey'),('Christian','F.W.K Okpattah'),('Benjamin','Anane'),
  ('Collins','Kweku Ofosu'),('Nigel','Sackey'),('Philip','Asomani'),
  ('George','Tete Mensah'),('Wilkins','Nii Kpani Addy'),('Darryl','Amoatey'),
  ('Emmanuel','Arku Boison')
);

-- DRAGONS RL
with team as (select team_id from teams where name ilike '%dragon%' limit 1),
ins as (
  insert into players(team_id, first_name, last_name, date_of_birth, playing_status)
  select t.team_id, p.fn, p.ln, p.dob::date, 'inactive'
  from team t,
  (values
    ('Aaron',        'Attah Nartey',          '2006-06-10'),
    ('Ashong',       'Prosper Anang',         '2003-07-11'),
    ('Elvis',        'Ayertey',               '1997-08-16'),
    ('William',      'Pearce-Biney',          '2001-03-18'),
    ('Alexander',    'Dorpenyo',              '1991-04-22'),
    ('Prince',       'Chris Ebo Da-Gama Idan','1993-10-17'),
    ('Seth',         'Mac-Bruce',             '1989-05-02'),
    ('Kabutey',      'Sadique Nii Tetteh',    '2001-04-18'),
    ('Emmanuel',     'Amoah-Acheampong',      '1996-12-20'),
    ('John',         'Bless Mensah',          '1986-06-23'),
    ('Richard',      'Amevor',                '1988-09-13'),
    ('Abdulrahman',  'Moussa',                '1995-04-01'),
    ('Nana',         'Kwesi Asanta Boateng',  '1994-06-24'),
    ('Micheal',      'Quaye',                 '2001-08-05'),
    ('Sulemana',     'Yakubu',                '1999-06-29'),
    ('Jonathan',     'Adotey',               '1996-05-22'),
    ('Jeffery',      'Agboku',               '2005-09-20'),
    ('Godwin',       'Amanu',                '2000-11-14'),
    ('Samuel',       'Nsiah',                '2006-11-12'),
    ('Elikem',       'Kuwornu Kwami',        '1992-11-14'),
    ('Victor',       'Amegah',              '2001-08-18'),
    ('Evans',        'Alidu-Tetteh',         '2021-03-04'),
    ('Francis',      'Lawson',              '1994-10-04'),
    ('De-Suouza',    'David',               '2005-06-16'),
    ('Benjamin',     'Fiawoo',              '2006-09-19'),
    ('Prince',       'Addokwei Tetteh',     '2005-05-20'),
    ('Joseph',       'Mensah',              '2001-08-11')
  ) as p(fn, ln, dob)
  on conflict do nothing
  returning player_id, team_id
)
insert into _import_ids select player_id, team_id from ins;

insert into _import_ids(player_id, team_id)
select p.player_id, p.team_id
from players p
join teams t on t.team_id = p.team_id and t.name ilike '%dragon%'
where (p.first_name, p.last_name) in (
  ('Aaron','Attah Nartey'),('Ashong','Prosper Anang'),('Elvis','Ayertey'),
  ('William','Pearce-Biney'),('Alexander','Dorpenyo'),('Prince','Chris Ebo Da-Gama Idan'),
  ('Seth','Mac-Bruce'),('Kabutey','Sadique Nii Tetteh'),('Emmanuel','Amoah-Acheampong'),
  ('John','Bless Mensah'),('Richard','Amevor'),('Abdulrahman','Moussa'),
  ('Nana','Kwesi Asanta Boateng'),('Micheal','Quaye'),('Sulemana','Yakubu'),
  ('Jonathan','Adotey'),('Jeffery','Agboku'),('Godwin','Amanu'),
  ('Samuel','Nsiah'),('Elikem','Kuwornu Kwami'),('Victor','Amegah'),
  ('Evans','Alidu-Tetteh'),('Francis','Lawson'),('De-Suouza','David'),
  ('Benjamin','Fiawoo'),('Prince','Addokwei Tetteh'),('Joseph','Mensah')
);

-- NUNGUA TIGERS
with team as (select team_id from teams where name ilike '%tiger%' limit 1),
ins as (
  insert into players(team_id, first_name, last_name, date_of_birth, playing_status)
  select t.team_id, p.fn, p.ln, p.dob::date, 'inactive'
  from team t,
  (values
    ('Emmanuel',  'Ebenezer Nii Okai',  '1997-01-06'),
    ('Andy',      'Afotey Annang',      '2004-09-17'),
    ('Martin',    'Prince Nii Aryeetey','1997-10-23'),
    ('Charles',   'Kwaku Dzisah',       '1997-04-11'),
    ('Kofi',      'Montchon',           '1998-11-26'),
    ('Godfred',   'Aikins',             '2008-05-07'),
    ('Adinyira',  'Stephen Kwame',      '1983-06-25'),
    ('Anthony',   'Elorm Awuku',        '1995-05-09'),
    ('Ntiamoah',  'Benjamin Oduro',     '2000-12-24'),
    ('Diego',     'Garcia Aguilar',     '1983-07-25'),
    ('Ibrahim',   'Abdul Rashid',       '1995-07-25'),
    ('Emmanueal', 'Darku',              '2002-12-21'),
    ('David',     'Mensah Lomotey',     '2005-11-30'),
    ('Ampoful',   'Festus Nana',        '2002-05-23'),
    ('Philip',    'Arthur',             '2001-10-22'),
    ('Joseph',    'Mensah',             '2001-08-11'),
    ('Anthony',   'Amanor Tawiah',      '1993-07-05'),
    ('Sani',      'Alhassan',           '1992-06-02'),
    ('Abdul',     'Razak Ismail',       '2001-12-16'),
    ('Eric',      'Quaye',              '1989-07-12'),
    ('Nathaniel', 'Addy',               '1985-11-06'),
    ('Dickson',   'Dzidzornu',          '1994-10-06'),
    ('Samuel',    'Oscar Kodji',        '1987-04-16')
  ) as p(fn, ln, dob)
  on conflict do nothing
  returning player_id, team_id
)
insert into _import_ids select player_id, team_id from ins;

insert into _import_ids(player_id, team_id)
select p.player_id, p.team_id
from players p
join teams t on t.team_id = p.team_id and t.name ilike '%tiger%'
where (p.first_name, p.last_name) in (
  ('Emmanuel','Ebenezer Nii Okai'),('Andy','Afotey Annang'),('Martin','Prince Nii Aryeetey'),
  ('Charles','Kwaku Dzisah'),('Kofi','Montchon'),('Godfred','Aikins'),
  ('Adinyira','Stephen Kwame'),('Anthony','Elorm Awuku'),('Ntiamoah','Benjamin Oduro'),
  ('Diego','Garcia Aguilar'),('Ibrahim','Abdul Rashid'),('Emmanueal','Darku'),
  ('David','Mensah Lomotey'),('Ampoful','Festus Nana'),('Philip','Arthur'),
  ('Joseph','Mensah'),('Anthony','Amanor Tawiah'),('Sani','Alhassan'),
  ('Abdul','Razak Ismail'),('Eric','Quaye'),('Nathaniel','Addy'),
  ('Dickson','Dzidzornu'),('Samuel','Oscar Kodji')
);

-- SKOLARS
with team as (select team_id from teams where name ilike '%skolar%' limit 1),
ins as (
  insert into players(team_id, first_name, last_name, date_of_birth, playing_status)
  select t.team_id, p.fn, p.ln, p.dob::date, 'inactive'
  from team t,
  (values
    ('Bright',    'Antwi',               '1995-02-01'),
    ('Riddick',   'Alibah',              '1993-02-12'),
    ('Emmanuel',  'Avumatsodo',          '1993-02-27'),
    ('David',     'Nartey',              '1995-11-22'),
    ('Bernard',   'Tettey',              '2008-05-30'),
    ('Michael',   'Egyiri',              '1992-10-22'),
    ('Nathaniel', 'Sekyi',               '2009-02-14'),
    ('Jeswin',    'Agoablo',             '2008-12-26'),
    ('Sadik',     'Ahmed',               '2001-05-16'),
    ('James',     'Yin',                 '1990-05-17'),
    ('Courage',   'Sena Fabien Daniels', '1987-02-22'),
    ('Ahmad',     'Kotob',               '1997-04-14'),
    ('Joseph',    'Brew',                '2002-09-25'),
    ('Jude',      'Lamptey',             '2001-08-24'),
    ('Stefan',    'Benchimol Dahan',     '1980-09-22'),
    ('Samuel',    'Aryee',               '2008-08-19'),
    ('Sulaimon',  'Olawale Sanni',       '2000-01-24'),
    ('Iliyasu',   'Musbaw',              '1998-02-11'),
    ('Hope',      'Sackey',              '2008-08-31'),
    ('Alhassan',  'Osman',               '2002-05-24'),
    ('Emmanuel',  'Fedah',               '1989-11-29')
  ) as p(fn, ln, dob)
  on conflict do nothing
  returning player_id, team_id
)
insert into _import_ids select player_id, team_id from ins;

insert into _import_ids(player_id, team_id)
select p.player_id, p.team_id
from players p
join teams t on t.team_id = p.team_id and t.name ilike '%skolar%'
where (p.first_name, p.last_name) in (
  ('Bright','Antwi'),('Riddick','Alibah'),('Emmanuel','Avumatsodo'),
  ('David','Nartey'),('Bernard','Tettey'),('Michael','Egyiri'),
  ('Nathaniel','Sekyi'),('Jeswin','Agoablo'),('Sadik','Ahmed'),
  ('James','Yin'),('Courage','Sena Fabien Daniels'),('Ahmad','Kotob'),
  ('Joseph','Brew'),('Jude','Lamptey'),('Stefan','Benchimol Dahan'),
  ('Samuel','Aryee'),('Sulaimon','Olawale Sanni'),('Iliyasu','Musbaw'),
  ('Hope','Sackey'),('Alhassan','Osman'),('Emmanuel','Fedah')
);

-- UG TITANS
with team as (select team_id from teams where name ilike '%titan%' limit 1),
ins as (
  insert into players(team_id, first_name, last_name, date_of_birth, playing_status)
  select t.team_id, p.fn, p.ln, p.dob::date, 'inactive'
  from team t,
  (values
    ('Papa',       'Sakyi Baidoo',          '2003-04-23'),
    ('Davies',     'Dorm',                  '2006-06-14'),
    ('George',     'Quist',                 '2003-11-18'),
    ('Edem',       'Kwaku Afriyie Tetteh',  '2006-04-19'),
    ('George',     'Tetteh Ayettey',        '2003-04-24'),
    ('Dennis',     'Elliot Allotey',        '2003-07-15'),
    ('Cephas',     'Doe',                   '2005-10-24'),
    ('Nii',        'Anyetei Odoi Mensah',   '2005-02-26'),
    ('Bernard',    'Akoto',                 '2006-03-04'),
    ('Gideon',     'Opoku Boateng',         '1999-09-18'),
    ('Edward',     'Nyame',                 '1990-06-05'),
    ('Boateng',    'Stephen',               '2004-04-15'),
    ('Nicholas',   'Amoaful',               '2005-04-25'),
    ('Umar',       'Farouk Raji',           '2004-06-07'),
    ('Borketey',   'Justice Bortey',        '2006-05-29'),
    ('Michael',    'Maximillian Pele Sekyi','2003-03-15'),
    ('Smyly',      'Nii Otu Chinery',       '2003-01-04'),
    ('Ichabod',    'Osei Bonsu',            '2000-10-04'),
    ('Bright',     'Anidaba',               '2005-04-24'),
    ('Quarshie',   'Nii Odoi Desmond',      '2003-04-01'),
    ('Kuwornu',    'Kelvin Elikplim',       '2004-06-17'),
    ('Emmanuel',   'Amponsah Jnr',          '2003-10-02'),
    ('Ken',        'Turkson',               '2003-06-13'),
    ('Edwin',      'Teye',                  '2003-12-04'),
    ('Constantine','Offei',                 '2003-10-30')
  ) as p(fn, ln, dob)
  on conflict do nothing
  returning player_id, team_id
)
insert into _import_ids select player_id, team_id from ins;

insert into _import_ids(player_id, team_id)
select p.player_id, p.team_id
from players p
join teams t on t.team_id = p.team_id and t.name ilike '%titan%'
where (p.first_name, p.last_name) in (
  ('Papa','Sakyi Baidoo'),('Davies','Dorm'),('George','Quist'),
  ('Edem','Kwaku Afriyie Tetteh'),('George','Tetteh Ayettey'),('Dennis','Elliot Allotey'),
  ('Cephas','Doe'),('Nii','Anyetei Odoi Mensah'),('Bernard','Akoto'),
  ('Gideon','Opoku Boateng'),('Edward','Nyame'),('Boateng','Stephen'),
  ('Nicholas','Amoaful'),('Umar','Farouk Raji'),('Borketey','Justice Bortey'),
  ('Michael','Maximillian Pele Sekyi'),('Smyly','Nii Otu Chinery'),('Ichabod','Osei Bonsu'),
  ('Bright','Anidaba'),('Quarshie','Nii Odoi Desmond'),('Kuwornu','Kelvin Elikplim'),
  ('Emmanuel','Amponsah Jnr'),('Ken','Turkson'),('Edwin','Teye'),('Constantine','Offei')
);

-- ── Step 3: Register all collected players for 2026 ─────────
insert into player_registrations(player_id, team_id, season_year)
select distinct player_id, team_id, 2026
from _import_ids
where player_id is not null
on conflict (player_id, season_year) do update set team_id = excluded.team_id;

-- ── Verification ────────────────────────────────────────────
select
  t.name                          as team,
  count(distinct pr.player_id)    as registered_2026
from player_registrations pr
join teams t on t.team_id = pr.team_id
where pr.season_year = 2026
group by t.name
order by t.name;
