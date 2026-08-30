-- ============================================================
-- Clubs name their side; the federation signs it off.
--
-- match_lineups already holds who played, but only the federation could
-- write it, so a team sheet arrived by message and was typed in by hand on
-- match day. The club knows its own side days earlier.
--
-- The approval belongs to the sheet, not to each player on it — a club
-- submits fifteen names as one act and the federation approves or declines
-- that act. So the state lives in its own row per club per fixture, and
-- match_lineups keeps holding the names.
--
-- Every line-up already on record is marked approved: the federation
-- entered it, so it is already signed off, and nothing on the site changes.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists team_sheets (
  sheet_id     uuid primary key default gen_random_uuid(),
  fixture_id   uuid not null references fixtures(fixture_id) on delete cascade,
  team_id      uuid not null references teams(team_id) on delete cascade,

  -- draft     the club is still building it and nobody else sees it
  -- submitted with the federation, and locked to the club
  -- approved  this is the side, and the recorder works from it
  -- declined  sent back with a reason; the club can edit and resubmit
  status       text not null default 'draft'
               check (status in ('draft', 'submitted', 'approved', 'declined')),

  submitted_by uuid,
  submitted_at timestamptz,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now(),

  -- One sheet per club per fixture. Both sides of a match get their own.
  constraint one_sheet_per_club_per_fixture unique (fixture_id, team_id)
);

create index if not exists idx_team_sheets_status on team_sheets(status)
  where status <> 'approved';
create index if not exists idx_team_sheets_fixture on team_sheets(fixture_id);

comment on table team_sheets is
  'Approval state for one club''s line-up for one fixture. The names live in match_lineups.';

-- ── Nothing already recorded changes meaning ────────────────
-- Every line-up on record was entered by the federation, so it is approved.
insert into team_sheets (fixture_id, team_id, status, reviewed_at)
select distinct l.fixture_id, l.team_id, 'approved', now()
from match_lineups l
on conflict (fixture_id, team_id) do nothing;

-- ── Row level security ──────────────────────────────────────
-- Clubs reach this through the portal's server actions, which use the
-- service key and check ownership themselves — the same way the club squad
-- pages already work. No client writes directly, so no write policy.
-- Reading is public because an approved team sheet is match-day information.
alter table team_sheets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'team_sheets' and policyname = 'public read approved team sheets'
  ) then
    create policy "public read approved team sheets" on team_sheets
      for select using (status = 'approved');
  end if;
end $$;

-- ── What is on record now ───────────────────────────────────
select status, count(*) as sheets
from team_sheets
group by status
order by status;
