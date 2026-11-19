-- ============================================================
-- Accreditations: people who need an ID card but are not players,
-- coaches, match officials or on the board/committee.
--
-- Photographers, social media managers, team managers, physios,
-- volunteers. The federation adds them in Admin → ID Cards → Staff & media
-- and prints their card there.
--
-- Nothing is ever deleted: a card that should no longer work is revoked,
-- and the public verify page then says so.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
-- ============================================================

create table if not exists accreditations (
  accreditation_id uuid primary key default gen_random_uuid(),
  full_name     text not null,
  role          text not null,                       -- "Photographer", "Team Manager"
  category      text not null default 'team_staff'
                  check (category in ('federation_staff', 'team_staff', 'medical', 'media', 'volunteer')),
  team_id       uuid references teams(team_id) on delete set null,
  organisation  text,                                -- a media outlet, when not a club
  photo_url     text,
  valid_until   date,
  status        text not null default 'active' check (status in ('active', 'revoked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists accreditations_team_idx on accreditations (team_id);

-- Service role only: the admin writes through server actions, and the public
-- verify page reads through the server.
alter table accreditations enable row level security;
