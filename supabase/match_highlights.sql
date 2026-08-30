-- ============================================================
-- Match highlights, and one fixture the earlier seed could not place.
--
-- The results spreadsheet behind data/schedule.json carries a YouTube link
-- per match that schedule.json dropped, so the website never had them. 49
-- matches have one.
--
-- Rows are matched on competition, season, both teams and the date rather
-- than on the fixture slug. Youth and men's sides of the same two clubs
-- played on the same day more than once, so their generated slugs collide
-- and a slug match would attach a youth video to the men's fixture.
--
-- Run AFTER womens_youth_seed.sql. Safe to re-run.
-- ============================================================

-- ── 1. The fixture the seed skipped ─────────────────────────
-- African Warriors v Skolars, 14 April 2024, was played in both the men's
-- and the youth championship on the same day. Both generate the slug
-- african-warriors-skolars-14-04-24, the men's fixture already held it, and
-- the youth fixture was silently passed over. It gets an explicit slug.

insert into fixtures (competition_id, home_team_id, away_team_id, venue_id, scheduled_date, status, slug)
select
  c.competition_id, h.team_id, a.team_id, v.venue_id,
  date '2024-04-14', 'completed', 'african-warriors-skolars-14-04-24-youth'
from competitions c
join teams h on h.name = 'African Warriors'
join teams a on a.name = 'Skolars'
left join venues v on v.name = 'Ajax Park'
where c.name = 'Youth 13s Championship' and c.season = '2024'
  and not exists (
    select 1 from fixtures f where f.slug = 'african-warriors-skolars-14-04-24-youth'
  );

insert into match_results (fixture_id, home_score, away_score)
select f.fixture_id, 12, 0
from fixtures f
where f.slug = 'african-warriors-skolars-14-04-24-youth'
  and not exists (select 1 from match_results r where r.fixture_id = f.fixture_id);

-- ── 2. Highlight links ──────────────────────────────────────

-- The links, carried inline rather than staged in a table. A temp table
-- would work, but creating one trips the SQL editor's "table without RLS"
-- and "destructive operation" warnings for something that only ever exists
-- inside this statement.

-- Only fills a gap; a link already recorded is left alone.
update match_results r
set video_url = s.url
from (values
  ('Men''s 13s Championship', '2024', 'Accra Majestics', 'Accra Panthers', '2024-01-28', 'https://www.youtube.com/embed/MF8VM66ptPA?si=sBb6_h047AMaeXdV'),
  ('Youth 13s Championship', '2024', 'African Warriors', 'Accra Panthers', '2024-03-10', 'https://www.youtube.com/embed/6oyzo6tYzyQ?si=7D-04qM20-z1QDfd'),
  ('Youth 13s Championship', '2024', 'Accra Panthers', 'African Warriors', '2024-04-07', 'https://www.youtube.com/embed/QDl36WW-PB8?si=abvk65bKWG49dZ8f'),
  ('Men''s 9s Championship', '2024', 'Bulls', 'Titans', '2024-10-06', 'https://www.youtube.com/embed/Q1hwrNAIhEE'),
  ('Men''s 9s Championship', '2024', 'Skolars', 'Accra Panthers', '2024-10-06', 'https://www.youtube.com/embed/TNRAbGO4iwE'),
  ('Men''s 9s Championship', '2024', 'Nungua Tigers', 'Accra Majestics', '2024-10-06', 'https://www.youtube.com/embed/hpVm8QVBuwc'),
  ('Men''s 9s Championship', '2024', 'Titans', 'Skolars', '2024-10-06', 'https://www.youtube.com/embed/2j1ANabbLS8'),
  ('Men''s 9s Championship', '2024', 'Accra Majestics', 'Accra Panthers', '2024-10-06', 'https://www.youtube.com/embed/YaxEuRDoONs'),
  ('Men''s 9s Championship', '2024', 'Nungua Tigers', 'Bulls', '2024-10-06', 'https://www.youtube.com/embed/UNMPzrMA_rM'),
  ('Men''s 9s Championship', '2024', 'Titans', 'Nungua Tigers', '2024-10-06', 'https://www.youtube.com/embed/lHYiThP28OI'),
  ('Men''s 9s Championship', '2024', 'Accra Panthers', 'Bulls', '2024-10-06', 'https://www.youtube.com/embed/zdaEMcDsTnU'),
  ('Men''s 9s Championship', '2024', 'Nungua Tigers', 'Skolars', '2024-10-06', 'https://www.youtube.com/embed/5Vydkdpf0a4'),
  ('Men''s 9s Championship', '2024', 'Bulls', 'Accra Majestics', '2024-10-06', 'https://www.youtube.com/embed/rY4Mdz-36xc'),
  ('Men''s 9s Championship', '2024', 'Nungua Tigers', 'Accra Panthers', '2024-10-13', 'https://www.youtube.com/embed/rtTCM3JwgY8'),
  ('Men''s 9s Championship', '2024', 'Accra Majestics', 'Titans', '2024-10-13', 'https://www.youtube.com/embed/k1zfr562hMA'),
  ('Men''s 9s Championship', '2024', 'Skolars', 'Bulls', '2024-10-13', 'https://www.youtube.com/embed/7QN_lmY0-O4'),
  ('Women''s 9s Championship', '2024', 'Accra Panthers', 'Bulls', '2024-10-13', 'https://www.youtube.com/embed/Lkku34TVSy8'),
  ('Women''s 9s Championship', '2024', 'Accra Majestics', 'Nungua Tigers', '2024-10-13', 'https://www.youtube.com/embed/74VKc9k4kro'),
  ('Men''s 13s Championship', '2025', 'Bulls', 'Accra Panthers', '2025-05-11', 'https://www.youtube.com/embed/2ZH1XSagQJM'),
  ('Men''s 13s Championship', '2025', 'Skolars', 'Nungua Tigers', '2025-05-11', 'https://www.youtube.com/embed/pXpB1wKrkEk'),
  ('Men''s 13s Championship', '2025', 'Dragons', 'Titans', '2025-05-18', 'https://www.youtube.com/embed/Ra6BrZePNsk'),
  ('Men''s 13s Championship', '2025', 'Accra Panthers', 'Skolars', '2025-05-18', 'https://www.youtube.com/embed/6Xbk2fs2fuY'),
  ('Men''s 13s Championship', '2025', 'Titans', 'Nungua Tigers', '2025-05-25', 'https://www.youtube.com/embed/Ra6BrZePNsk'),
  ('Men''s 13s Championship', '2025', 'Dragons', 'Bulls', '2025-05-25', 'https://www.youtube.com/embed/FwbnEqi1sWc'),
  ('Men''s 13s Championship', '2025', 'Skolars', 'Titans', '2025-06-01', 'https://www.youtube.com/embed/UBS7RelxI18?si=3NgDGzOhe4aN_hhf'),
  ('Men''s 13s Championship', '2025', 'Accra Panthers', 'Dragons', '2025-06-01', 'https://www.youtube.com/embed/hTwV44sornY?si=QuWcAm7rdCkBeftZZ'),
  ('Men''s 13s Championship', '2025', 'Nungua Tigers', 'Bulls', '2025-06-22', 'https://www.youtube.com/embed/1IuStEVwpDc?si=RJPk1FXpy60fEpc1'),
  ('Men''s 13s Championship', '2025', 'Dragons', 'Skolars', '2025-06-22', 'https://www.youtube.com/embed/dsAn5-fLzsk?si=d3G_qbzh2eawQOax'),
  ('Men''s 13s Championship', '2025', 'Bulls', 'Titans', '2025-06-29', 'https://www.youtube.com/embed/d5wOKmT9Zfc?si=0hAO9ZvZYoYjQGGi'),
  ('Men''s 13s Championship', '2025', 'Nungua Tigers', 'Accra Panthers', '2025-06-29', 'https://www.youtube.com/embed/CojIR6SM2sg?si=Fs0W8nafzM9_NmEs'),
  ('Men''s 13s Championship', '2025', 'Skolars', 'Bulls', '2025-07-06', 'https://www.youtube.com/embed/yqBTOd8t3-U?si=y41dkChy-EXE4yOv'),
  ('Men''s 13s Championship', '2025', 'Dragons', 'Nungua Tigers', '2025-07-06', 'https://www.youtube.com/embed/Y8i3nU4X_gA?si=M8Fy8kxQILjn7_KL'),
  ('Men''s 13s Championship', '2025', 'Nungua Tigers', 'Skolars', '2025-07-27', 'https://www.youtube.com/embed/1cW1X_RR6nA?si=zZyZ5YXwy7jcp8sy'),
  ('Men''s 13s Championship', '2025', 'Accra Panthers', 'Bulls', '2025-07-27', 'https://www.youtube.com/embed/-QNFtQwGoNE?si=2fSeSRWBg5_Pnn4u'),
  ('Men''s 13s Championship', '2025', 'Titans', 'Dragons', '2025-08-03', 'https://www.youtube.com/embed/h1Fo2oJcnbM?si=nP6Smrnwsyp1fWLj'),
  ('Men''s 13s Championship', '2025', 'Skolars', 'Accra Panthers', '2025-08-03', 'https://www.youtube.com/embed/_Lk6SJpLseo?si=9DJOC2aV_9SlHeHM'),
  ('Men''s 13s Championship', '2025', 'Nungua Tigers', 'Titans', '2025-08-10', 'https://www.youtube.com/embed/rOMNy0_9VzI?si=lKSAL8qhguSzHxFh'),
  ('Men''s 13s Championship', '2025', 'Bulls', 'Dragons', '2025-08-10', 'https://www.youtube.com/embed/bZ9bhTZ5rro?si=T69aYX5UM5uB2LfO'),
  ('Men''s 13s Championship', '2025', 'Bulls', 'Nungua Tigers', '2025-08-24', 'https://www.youtube.com/embed/W_uSEMdg4zg?si=dhxgBNW1PWXVDUf2'),
  ('Men''s 13s Championship', '2025', 'Nungua Tigers', 'Bulls', '2025-09-14', 'https://www.youtube.com/embed/6kxll0h7vJo?si=1kbH2UPlSjqzlAzZ'),
  ('Youth Girls’ Rugby League 13s Championship', '2025', 'Skolars', 'Nungua Tigers', '2025-09-05', 'https://www.youtube.com/embed/9OxdEQ79L1A?si=TLogVxWNGvDhzE8l'),
  ('Youth Girls’ Rugby League 13s Championship', '2025', 'Bulls', 'Accra Panthers', '2025-09-05', 'https://www.youtube.com/embed/tCbeeZW0DTE?si=MAsUW0OxSqPUFWRm'),
  ('Youth 13s Championship', '2025', 'Nungua Tigers', 'Skolars', '2025-09-05', 'https://www.youtube.com/embed/UaxjnqFSDuU?si=73JoW2WaU_DEul3L'),
  ('Youth 13s Championship', '2025', 'Accra Panthers', 'Bulls', '2025-09-05', 'https://www.youtube.com/embed/01A44ueZuSI?si=0mjVDTIWhNOUKm9G'),
  ('Youth Girls’ Rugby League 13s Championship', '2025', 'Accra Panthers', 'Skolars', '2025-09-12', 'https://youtube.com/shorts/uugQNUvz8So?si=RSukAS1yF8Z_8ukm'),
  ('Youth 13s Championship', '2025', 'Accra Panthers', 'Skolars', '2025-09-12', 'https://youtube.com/shorts/57yWLEfk25A?si=HKTXUNUxAl-6xF72'),
  ('Men''s 13s Championship', '2026', 'Bulls', 'Titans', '2026-04-12', 'https://www.youtube.com/embed/LSJDrxSCQvg?si=1lHed1pgHS3xHlWd'),
  ('Men''s 13s Championship', '2026', 'Dragons', 'Nungua Tigers', '2026-04-12', 'https://www.youtube.com/embed/_kPnbfzm9L4?si=VM5k9zwd3FPQlEVi'),
  ('Men''s 13s Championship', '2026', 'Accra Panthers', 'Skolars', '2026-04-12', 'https://www.youtube.com/embed/0-Xy3qHjhi0?si=9DOH5pODYJ_NMCyG')
) as s(comp, season, home, away, dt, url)
join competitions c on c.name = s.comp and c.season = s.season
join teams h on h.name = s.home
join teams a on a.name = s.away
join fixtures f
  on f.competition_id = c.competition_id
 and f.home_team_id = h.team_id
 and f.away_team_id = a.team_id
 and f.scheduled_date = s.dt::date
where r.fixture_id = f.fixture_id
  and (r.video_url is null or r.video_url = '');

