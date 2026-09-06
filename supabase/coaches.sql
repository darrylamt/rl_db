-- ============================================================
-- Coaches, and who was in charge of a side on the day.
--
-- teams.coach_name has been a free-text field on the club record: one name,
-- no history, and nothing tying it to a match. It answers "who coaches this
-- club now" and nothing else — so a coach who moves clubs takes their whole
-- record with them, and a coach who took charge of three matches in 2024
-- leaves no trace at all.
--
-- WHO SETS WHAT
--   The federation keeps the roster. A club cannot invent a coach; it picks
--   one the federation has already registered, for its own team sheet only.
--   That is the same shape as the rest of the portal — clubs fill in their
--   own side, the federation holds the register.
--
--   A coach may be tied to one club, or left open. Tied is the normal case
--   and stops Bulls naming Skolars' coach; open is for the federation's own
--   people and for anyone who works across clubs.
--
-- WHERE THE RECORD LIVES
--   On the team sheet, because a sheet is already one club's side for one
--   fixture — which is exactly the thing a coach is in charge of. Two
--   columns rather than another join table, so "every match this person
--   coached" is a query anybody can read.
--
--   That does mean a coach's record only covers matches with a team sheet.
--   Two thirds of matches on record have none, so the counts will look thin
--   until team sheets are the norm. Thin and true beats full and guessed.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists coaches (
  coach_id    uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,

  -- The club this coach may be named by. Null means any club can name them.
  team_id     uuid references teams(team_id) on delete set null,

  -- "Head Coach", "Assistant", "Strength & Conditioning" — the federation's
  -- own words, not a fixed list, because the titles are still settling.
  role        text,
  qualification text,
  region      text,
  nationality text,
  photo_url   text,
  phone       text,
  email       text,
  status      text not null default 'active'
              check (status in ('active', 'inactive')),
  created_at  timestamptz not null default now()
);

create index if not exists idx_coaches_team on coaches(team_id);
create index if not exists idx_coaches_status on coaches(status) where status = 'active';

comment on table coaches is
  'The federation''s coaching register. Clubs pick from it for their own team sheets.';

-- ── Who was in charge, per side, per match ──────────────────
alter table team_sheets add column if not exists head_coach_id
  uuid references coaches(coach_id) on delete set null;
alter table team_sheets add column if not exists assistant_coach_id
  uuid references coaches(coach_id) on delete set null;

create index if not exists idx_team_sheets_head_coach
  on team_sheets(head_coach_id) where head_coach_id is not null;
create index if not exists idx_team_sheets_assistant_coach
  on team_sheets(assistant_coach_id) where assistant_coach_id is not null;

comment on column team_sheets.head_coach_id is
  'Who took charge of this side for this match. Picked by the club from the federation register.';

-- ── A starting point from the club records ──────────────────
-- teams.coach_name is the only coaching information that exists today. Each
-- distinct name becomes a coach tied to that club, so the register is not
-- empty on day one and nobody retypes what is already written down.
--
-- Names are split on the first space: everything before it is the first name,
-- the rest is the surname. That is wrong for some people, and it is meant to
-- be corrected in the admin rather than trusted.
insert into coaches (first_name, last_name, team_id, role, status)
select
  split_part(btrim(t.coach_name), ' ', 1)                                as first_name,
  nullif(btrim(substr(btrim(t.coach_name), strpos(btrim(t.coach_name), ' '))), '')
    as last_name,
  t.team_id,
  'Head Coach',
  'active'
from teams t
where t.coach_name is not null
  and btrim(t.coach_name) <> ''
  and strpos(btrim(t.coach_name), ' ') > 0
  and not exists (
    select 1 from coaches c
    where c.team_id = t.team_id
      and lower(c.first_name || ' ' || c.last_name) = lower(btrim(t.coach_name))
  );

-- ── Row level security ──────────────────────────────────────
-- Read is public: a coach's record shows on the website, the same as a
-- player's. Writing goes through server actions holding the service key,
-- which check whether the caller is the federation or the club that owns the
-- sheet — so no policy grants a write here.
alter table coaches enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'coaches' and policyname = 'public read coaches'
  ) then
    create policy "public read coaches" on coaches for select using (true);
  end if;
end $$;

-- ── What is on record ───────────────────────────────────────
select
  c.first_name || ' ' || c.last_name as coach,
  coalesce(t.name, 'any club')       as attached_to,
  c.role,
  c.status
from coaches c
left join teams t on t.team_id = c.team_id
order by t.name nulls last, c.last_name;
